"""Actual dialogue routing and explicit numeric-analysis evidence checks."""

from benchmarks.coaching.e2e.e2e_client import ScenarioIO
from coaching_service.evidence_encoding import decode_facts
from coaching_service.numeric_rendering import numeric_text
from coaching_service.schemas import Coaching, JsonDocument, Session


async def dialogue(flow: ScenarioIO, original: Coaching) -> Coaching:
    session = Session.model_validate(
        (await flow.request("POST", "/v1/sessions", JsonDocument({"coaching_id": original.id}))).root
    )
    latest = original
    for analysis in flow.case.analyses or (None,):
        before = len(flow.gateway.preflights)
        payload = JsonDocument({"question": flow.case.question})
        if analysis is not None:
            payload.root["analysis"] = analysis.root
        latest = await flow.verify_coaching(
            await flow.request("POST", f"/v1/sessions/{session.id}/messages", payload)
        )
        receipt = latest.receipt
        mode = receipt.routing.root.get("mode") if receipt.routing else None
        flow.observed_route = mode if isinstance(mode, str) else None
        source = receipt.routing.root.get("source") if receipt.routing else None
        if isinstance(source, str):
            flow.routing_sources.append(source)
        reason = receipt.routing.root.get("fallback_reason") if receipt.routing else None
        if isinstance(reason, str):
            flow.fallbacks.append(reason)
        flow.check(
            "dialogue_current_historical_separation",
            receipt.trigger == "dialogue"
            and receipt.payment is None
            and receipt.original_coaching_id == original.id
            and receipt.historical is not None
            and receipt.historical.engine_result == original.receipt.result,
        )
        flow.check(
            "numeric_policy_branch",
            (receipt.numeric_result is not None) == (analysis is not None or mode in {"risk", "forecast"}),
        )
        if analysis is not None:
            flow.check("explicit_analysis_exact", receipt.numeric_request == analysis)
        calls = flow.gateway.preflights[before:]
        routes = [row for row in calls if row.operation == "route"]
        writers = [row for row in calls if row.operation == "write"]
        flow.check("dialogue_operations", len(routes) == len(writers) == 1)
        if routes:
            route_receipt = receipt.model_copy(
                update={"routing": None, "numeric_request": None, "numeric_result": None}
            )
            flow.verify_projection(route_receipt, "route", routes[0].evidence)
        if receipt.numeric_result is not None and routes and writers:
            route_facts = decode_facts(JsonDocument.model_validate_json(routes[0].evidence.facts_json))
            writer_facts = decode_facts(JsonDocument.model_validate_json(writers[0].evidence.facts_json))
            displayed = writer_facts.root.get("authoritative_answer")
            flow.check(
                "dialogue_writer_has_displayed_numeric_facts",
                route_facts.root.get("numeric_result") is None
                and isinstance(displayed, str)
                and bool(numeric_text(receipt))
                and all(line in displayed for line in numeric_text(receipt)),
            )
        stored = Session.model_validate((await flow.request("GET", "/v1/sessions/" + session.id)).root)
        flow.check(
            "dialogue_messages_persisted",
            stored.messages[-2].content == flow.case.question and stored.messages[-1].content == latest.text,
        )
    return latest
