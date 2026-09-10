package com.finset.key_fin.finance.client;

import com.finset.key_fin.finance.dto.response.FinanceMember;

public interface FinanceMemberClient {

	FinanceMember findByEmail(String email);
}
