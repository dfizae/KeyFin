package com.finset.key_fin.shop;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/** Reviewed catalog contract, also published for the mobile asset mapping. */
final class CatalogFixture {
	static final JsonNode DOCUMENT = JsonMapper.builder().build().readTree(
			Objects.requireNonNull(CatalogFixture.class.getResourceAsStream("/catalog/items.json")));

	static List<JsonNode> items() {
		var result = new ArrayList<JsonNode>();
		DOCUMENT.path("items").forEach(result::add);
		return List.copyOf(result);
	}

	static List<String> keys() {
		return items().stream().map(item -> item.path("assetKey").asString()).toList();
	}

	private CatalogFixture() {}
}
