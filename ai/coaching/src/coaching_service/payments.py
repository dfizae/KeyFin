"""Envelope debits are distinct from account snapshots and monthly budget estimates."""

from datetime import date, timedelta
from decimal import ROUND_HALF_UP, Decimal

from coaching_service.errors import ServiceError
from coaching_service.schemas import Envelope, Frozen, PaymentFacts, TransactionView


class Debit(Frozen):
    transaction_id: str
    envelope: str
    amount_krw: int
    canceled: bool = False


class Ledger(Frozen):
    envelopes: tuple[Envelope, ...]
    debits: tuple[Debit, ...] = ()


class Detection(Frozen):
    ledger: Ledger
    reason: str
    facts: PaymentFacts | None = None


def reduce_payment(
    ledger: Ledger, transaction: TransactionView, transactions: tuple[TransactionView, ...]
) -> Detection:
    old = next((row for row in ledger.debits if row.transaction_id == transaction.id), None)
    if old is not None:
        if (
            transaction.active
            and not old.canceled
            and (transaction.envelope != old.envelope or transaction.budget_amount_krw != old.amount_krw)
        ):
            raise ServiceError("reclassification_requires_ledger_reconciliation", 409)
        if old.canceled or transaction.active:
            return Detection(ledger=ledger, reason="duplicate_transaction")
        updated = tuple(
            row.model_copy(update={"balance_krw": row.balance_krw + old.amount_krw})
            if row.envelope == old.envelope
            else row
            for row in ledger.envelopes
        )
        debits = tuple(
            row.model_copy(update={"canceled": True}) if row == old else row for row in ledger.debits
        )
        return Detection(ledger=Ledger(envelopes=updated, debits=debits), reason="cancellation_refunded")
    if not transaction.active or transaction.pending or transaction.budget_amount_krw <= 0:
        return Detection(ledger=ledger, reason="not_confirmed_envelope_debit")
    account = next((row for row in ledger.envelopes if row.envelope == transaction.envelope), None)
    if account is None:
        return Detection(ledger=ledger, reason="envelope_balance_missing")
    before = account.balance_krw
    after = before - transaction.budget_amount_krw
    if abs(after) > 10**12:
        raise ServiceError("envelope_balance_limit")
    updated = tuple(
        row.model_copy(update={"balance_krw": after}) if row == account else row for row in ledger.envelopes
    )
    debit = Debit(
        transaction_id=transaction.id, envelope=account.envelope, amount_krw=transaction.budget_amount_krw
    )
    new_ledger = Ledger(envelopes=updated, debits=(*ledger.debits, debit))
    monday = date.fromisoformat(transaction.date) - timedelta(
        days=date.fromisoformat(transaction.date).weekday()
    )
    count = sum(
        row.active
        and row.source == "LIVE"
        and not row.pending
        and row.budget_amount_krw > 0
        and row.envelope == transaction.envelope
        and monday.isoformat() <= row.date <= transaction.date
        and (row.date < transaction.date or row.time <= transaction.time)
        for row in transactions
    )
    percent = (
        str((Decimal(after) * 100 / before).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP))
        if before > 0
        else None
    )
    facts = PaymentFacts(
        transaction_id=transaction.id,
        envelope=account.envelope,
        amount_krw=debit.amount_krw,
        balance_before_krw=before,
        balance_after_krw=after,
        remaining_percent=percent,
        weekly_count=count,
    )
    if before <= 0:
        reason = "nonpositive_balance_needs_data"
    elif debit.amount_krw * 2 >= before:
        reason = "p0_half_balance"
    elif debit.amount_krw * 5 >= before * 2 or (count >= 5 and debit.amount_krw * 5 >= before):
        reason = "p1_ambiguous"
    else:
        reason = "below_trigger"
    return Detection(ledger=new_ledger, reason=reason, facts=facts)


def reconcile_cancellation(ledger: Ledger, transaction: TransactionView, balance: Envelope) -> Detection:
    if balance.envelope != transaction.envelope:
        raise ServiceError("cancellation_envelope_mismatch")
    accounts = tuple(row for row in ledger.envelopes if row.envelope != balance.envelope)
    debits = tuple(row for row in ledger.debits if row.transaction_id != transaction.id)
    debit = Debit(transaction_id=transaction.id, envelope=balance.envelope, amount_krw=0, canceled=True)
    return Detection(
        ledger=Ledger(envelopes=(*accounts, balance), debits=(*debits, debit)),
        reason="cancellation_reconciled",
    )
