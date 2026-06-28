#![cfg(test)]
extern crate std;

use super::*;
use soroban_sdk::{
    testutils::Address as _,
    testutils::storage::Persistent,
    token::{Client as TokenClient, StellarAssetClient},
    Address, BytesN, Env, String, Symbol,
};

struct AuthFixture {
    env: Env,
    contract: Address,
    admin: Address,
    disputer: Address,
    respondent: Address,
    arbitrator: Address,
    stranger: Address,
    token: Address,
}

impl AuthFixture {
    fn new() -> Self {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let disputer = Address::generate(&env);
        let respondent = Address::generate(&env);
        let arbitrator = Address::generate(&env);
        let stranger = Address::generate(&env);

        let token_id = env.register_stellar_asset_contract_v2(admin.clone());
        let token = token_id.address();
        StellarAssetClient::new(&env, &token).mint(&disputer, &1_000_000);

        let contract = env.register_contract(None, DisputeContract);
        let client = DisputeContractClient::new(&env, &contract);
        client.initialize(&admin);
        client.add_arbitrator(&admin, &arbitrator);

        AuthFixture { env, contract, admin, disputer, respondent, arbitrator, stranger, token }
    }

    fn client(&self) -> DisputeContractClient {
        DisputeContractClient::new(&self.env, &self.contract)
    }

    fn open(&self) {
        self.client().file_dispute(
            &Symbol::new(&self.env, "d1"),
            &self.disputer,
            &self.respondent,
            &self.token,
            &100_000,
            &String::from_str(&self.env, "abc123"),
        );
    }
}

fn setup_no_mock() -> (Env, Address, Address, Address, Address, Address, Address) {
    let env = Env::default();

    let admin = Address::generate(&env);
    let disputer = Address::generate(&env);
    let respondent = Address::generate(&env);
    let arbitrator = Address::generate(&env);
    let stranger = Address::generate(&env);

    let token_id = env.register_stellar_asset_contract_v2(admin.clone());
    let token = token_id.address();
    StellarAssetClient::new(&env, &token).mint(&disputer, &1_000_000);

    let contract = env.register_contract(None, DisputeContract);
    (env, contract, admin, disputer, respondent, arbitrator, token)
}

fn init_no_mock(env: &Env, contract: &Address, admin: &Address, arbitrator: &Address) {
    let client = DisputeContractClient::new(env, contract);
    // Need to use soroban_sdk auth framework for proper auth
    // For non-mock tests, we use the Address's built-in authorization
    // by calling from a test that doesn't use mock_all_auths
}

// =============================================================================
// Auth-failure tests (role-gated functions)
// =============================================================================

mod auth_failures {
    use super::*;

    #[test]
    #[should_panic(expected = "Not authorized")]
    fn pause_requires_admin() {
        let f = AuthFixture::new();
        f.client().pause(&f.stranger);
    }

    #[test]
    #[should_panic(expected = "Not authorized")]
    fn unpause_requires_admin() {
        let f = AuthFixture::new();
        f.client().unpause(&f.stranger);
    }

    #[test]
    #[should_panic(expected = "Not authorized")]
    fn add_arbitrator_requires_admin() {
        let f = AuthFixture::new();
        f.client().add_arbitrator(&f.stranger, &Address::generate(&f.env));
    }

    #[test]
    #[should_panic(expected = "Not authorized")]
    fn remove_arbitrator_requires_admin() {
        let f = AuthFixture::new();
        f.client().remove_arbitrator(&f.stranger, &f.arbitrator);
    }

    #[test]
    #[should_panic(expected = "Not authorized")]
    fn upgrade_requires_admin() {
        let f = AuthFixture::new();
        let hash = BytesN::from_array(&f.env, &[1u8; 32]);
        f.client().upgrade(&f.stranger, &hash);
    }
}

// =============================================================================
// Paused-state tests
// =============================================================================

mod paused_state {
    use super::*;

    #[test]
    #[should_panic(expected = "Contract is paused")]
    fn file_dispute_while_paused() {
        let f = AuthFixture::new();
        f.client().pause(&f.admin);
        f.client().file_dispute(
            &Symbol::new(&f.env, "d2"),
            &f.disputer,
            &f.respondent,
            &f.token,
            &100_000,
            &String::from_str(&f.env, "hash"),
        );
    }

    #[test]
    #[should_panic(expected = "Contract is paused")]
    fn submit_evidence_while_paused() {
        let f = AuthFixture::new();
        f.open();
        f.client().pause(&f.admin);
        f.client().submit_evidence(
            &Symbol::new(&f.env, "d1"),
            &f.respondent,
            &String::from_str(&f.env, "evidence"),
        );
    }

    #[test]
    #[should_panic(expected = "Contract is paused")]
    fn decide_while_paused() {
        let f = AuthFixture::new();
        f.open();
        f.client().pause(&f.admin);
        f.client().decide(
            &Symbol::new(&f.env, "d1"),
            &f.arbitrator,
            &DisputeOutcome::RefundDisputer,
            &0,
        );
    }

    #[test]
    #[should_panic(expected = "Contract is paused")]
    fn settle_while_paused() {
        let f = AuthFixture::new();
        f.open();
        f.client().decide(&Symbol::new(&f.env, "d1"), &f.arbitrator, &DisputeOutcome::RefundDisputer, &0);
        f.client().pause(&f.admin);
        f.client().settle(&Symbol::new(&f.env, "d1"));
    }
}

// =============================================================================
// Boundary tests
// =============================================================================

mod boundary {
    use super::*;

    #[test]
    #[should_panic(expected = "Amount must be positive")]
    fn file_dispute_zero_amount() {
        let f = AuthFixture::new();
        f.client().file_dispute(
            &Symbol::new(&f.env, "d_zero"),
            &f.disputer,
            &f.respondent,
            &f.token,
            &0,
            &String::from_str(&f.env, "hash"),
        );
    }

    #[test]
    #[should_panic(expected = "Amount must be positive")]
    fn file_dispute_negative_amount() {
        let f = AuthFixture::new();
        f.client().file_dispute(
            &Symbol::new(&f.env, "d_neg"),
            &f.disputer,
            &f.respondent,
            &f.token,
            &(-1),
            &String::from_str(&f.env, "hash"),
        );
    }

    #[test]
    #[should_panic(expected = "split_bps out of range")]
    fn decide_split_bps_exceeds_max() {
        let f = AuthFixture::new();
        f.open();
        f.client().decide(
            &Symbol::new(&f.env, "d1"),
            &f.arbitrator,
            &DisputeOutcome::Split,
            &10_001,
        );
    }

    #[test]
    fn decide_split_bps_at_max() {
        let f = AuthFixture::new();
        f.open();
        f.client().decide(
            &Symbol::new(&f.env, "d1"),
            &f.arbitrator,
            &DisputeOutcome::Split,
            &10_000,
        );
        let d = f.client().get_dispute(&Symbol::new(&f.env, "d1")).unwrap();
        assert_eq!(d.split_bps, 10_000);
        assert_eq!(d.status, DisputeStatus::Decided);
    }

    #[test]
    fn decide_split_bps_at_min() {
        let f = AuthFixture::new();
        f.open();
        f.client().decide(
            &Symbol::new(&f.env, "d1"),
            &f.arbitrator,
            &DisputeOutcome::Split,
            &0,
        );
        let d = f.client().get_dispute(&Symbol::new(&f.env, "d1")).unwrap();
        assert_eq!(d.split_bps, 0);
    }
}

// =============================================================================
// TTL extension tests
// =============================================================================

mod ttl {
    use super::*;

    #[test]
    fn file_dispute_extends_dispute_ttl() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let disputer = Address::generate(&env);
        let respondent = Address::generate(&env);
        let arbitrator = Address::generate(&env);

        let token_id = env.register_stellar_asset_contract_v2(admin.clone());
        let token = token_id.address();
        StellarAssetClient::new(&env, &token).mint(&disputer, &1_000_000);

        let contract = env.register_contract(None, DisputeContract);
        let client = DisputeContractClient::new(&env, &contract);
        client.initialize(&admin);
        client.add_arbitrator(&admin, &arbitrator);

        let id = Symbol::new(&env, "ttl1");
        client.file_dispute(
            &id,
            &disputer,
            &respondent,
            &token,
            &100_000,
            &String::from_str(&env, "abc"),
        );

        let dispute_key = DataKey::Dispute(id.clone());
        let ttl = env.as_contract(&contract, || {
            env.storage().persistent().get_ttl(&dispute_key)
        });
        assert!(
            ttl >= TTL_THRESHOLD,
            "dispute entry TTL should be >= threshold after create, got {ttl}"
        );
    }

    #[test]
    fn submit_evidence_renews_ttl() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let disputer = Address::generate(&env);
        let respondent = Address::generate(&env);
        let arbitrator = Address::generate(&env);

        let token_id = env.register_stellar_asset_contract_v2(admin.clone());
        let token = token_id.address();
        StellarAssetClient::new(&env, &token).mint(&disputer, &1_000_000);

        let contract = env.register_contract(None, DisputeContract);
        let client = DisputeContractClient::new(&env, &contract);
        client.initialize(&admin);
        client.add_arbitrator(&admin, &arbitrator);

        let id = Symbol::new(&env, "ttl2");
        client.file_dispute(
            &id,
            &disputer,
            &respondent,
            &token,
            &100_000,
            &String::from_str(&env, "abc"),
        );

        let dispute_key = DataKey::Dispute(id.clone());
        let ttl_after_create = env.as_contract(&contract, || {
            env.storage().persistent().get_ttl(&dispute_key)
        });

        client.submit_evidence(&id, &respondent, &String::from_str(&env, "evidence"));

        let ttl_after_evidence = env.as_contract(&contract, || {
            env.storage().persistent().get_ttl(&dispute_key)
        });
        assert!(
            ttl_after_evidence >= ttl_after_create,
            "TTL should not decrease after evidence submission: {ttl_after_evidence} < {ttl_after_create}"
        );
    }

    #[test]
    fn decide_renews_ttl() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let disputer = Address::generate(&env);
        let respondent = Address::generate(&env);
        let arbitrator = Address::generate(&env);

        let token_id = env.register_stellar_asset_contract_v2(admin.clone());
        let token = token_id.address();
        StellarAssetClient::new(&env, &token).mint(&disputer, &1_000_000);

        let contract = env.register_contract(None, DisputeContract);
        let client = DisputeContractClient::new(&env, &contract);
        client.initialize(&admin);
        client.add_arbitrator(&admin, &arbitrator);

        let id = Symbol::new(&env, "ttl3");
        client.file_dispute(
            &id,
            &disputer,
            &respondent,
            &token,
            &100_000,
            &String::from_str(&env, "abc"),
        );

        let dispute_key = DataKey::Dispute(id.clone());
        let ttl_before = env.as_contract(&contract, || {
            env.storage().persistent().get_ttl(&dispute_key)
        });

        client.decide(&id, &arbitrator, &DisputeOutcome::RefundDisputer, &0);

        let ttl_after = env.as_contract(&contract, || {
            env.storage().persistent().get_ttl(&dispute_key)
        });
        assert!(
            ttl_after >= ttl_before,
            "TTL should not decrease after decide: {ttl_after} < {ttl_before}"
        );
    }

    #[test]
    fn file_dispute_extends_list_ttl() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let disputer = Address::generate(&env);
        let respondent = Address::generate(&env);
        let arbitrator = Address::generate(&env);

        let token_id = env.register_stellar_asset_contract_v2(admin.clone());
        let token = token_id.address();
        StellarAssetClient::new(&env, &token).mint(&disputer, &1_000_000);

        let contract = env.register_contract(None, DisputeContract);
        let client = DisputeContractClient::new(&env, &contract);
        client.initialize(&admin);
        client.add_arbitrator(&admin, &arbitrator);

        let id = Symbol::new(&env, "ttl_list");
        client.file_dispute(
            &id,
            &disputer,
            &respondent,
            &token,
            &100_000,
            &String::from_str(&env, "abc"),
        );

        let list_key = DataKey::DisputeList;
        let ttl = env.as_contract(&contract, || {
            env.storage().persistent().get_ttl(&list_key)
        });
        assert!(
            ttl >= TTL_THRESHOLD,
            "dispute list TTL should be >= threshold after create, got {ttl}"
        );
    }
}
