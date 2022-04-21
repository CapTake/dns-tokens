#include "../partial/fa2_types.ligo"
#include "../partial/fa2_errors.ligo"

type token_extra is record [
  enable    : bool;
  expires   : option(timestamp);
  notbefore : timestamp;
  tokens    : nat;
]

 type storage is record [
    admin          : address;
    pending_admin  : option(address);
    token          : address;
    last_id        : token_id;
    ledger         : big_map (address * token_id, nat);
    signer         : key;
    metadata       : big_map (string, bytes);
    token_metadata : big_map (token_id, token_meta);
    extra          : big_map (token_id, token_extra)
 ]

type return is list (operation) * storage

type create_achievement_params is map(string, bytes) * nat

type update_token_metadata_params is record [
    token_id : token_id;
    metadata : map(string, bytes);
]

type update_achievement_params is [@layout:comb] record[
  token_id  : token_id;
  notbefore : timestamp;
  expires   : option(timestamp);
  tokens    : nat;
]

type claim is token_id * address;

type claim_params is bytes * signature

type fa2_contract is contract(transfer_params)

type action is
  | Balance_of of balance_of_params
  | Claim_achievement of claim_params
  | Confirm_admin
  | Create_achievement of create_achievement_params
  | Enable_achievement of token_id * bool
  | Register_signer of key
  | Register_token_contract of address
  | Set_admin of option(address)
  | Transfer of transfer_params
  | Update_achievement of update_achievement_params
  | Update_operators of update_operator_params
  | Update_token_metadata of update_token_metadata_params
  | Withdraw_tokens of nat * address


const noop : list (operation) = (nil: list (operation))
const asset_id : nat = 0n
const error_access_denied = "Access denied"
const error_not_a_pending_admin = "Not a pending admin"
const error_bad_fa2_contract = "Bad token contract"

  [@inline]
  function get_balance(const owner : owner; const token_id : token_id; const s : storage) : amt is
    case s.ledger[(owner, token_id)] of [
        | None -> 0n
        | Some(a) -> a
    ]

  function transfer_tokens(const p : nat * address; const _s : storage) : list(operation) is block {
    const param : transfer_params = list[record[from_=Tezos.self_address; txs=list[record[to_=p.1; amount=p.0; token_id=asset_id]]]];
    const fa2 : fa2_contract = Option.unopt_with_error((Tezos.get_entrypoint_opt("%transfer", _s.token) : option(fa2_contract)), error_bad_fa2_contract);
  } with list[Tezos.transaction(param, 0tez, fa2)]

  function fa2_transfer(const _p : transfer_params; const _s : storage) : return is (failwith(fa2_tx_denied) : return)

  function fa2_balance_of(const params : balance_of_params; const s : storage) : return is
    begin
      function get_balance_response (const r : balance_of_request) : balance_of_response is
        record[
          balance = if asset_id = r.token_id then get_balance(r.owner, r.token_id, s) else (failwith(fa2_token_undefined) : amt);
          request = r;
        ];
    end with (list [Tezos.transaction(List.map(get_balance_response, params.requests), 0tz, params.callback)], s)

  function fa2_update_operators(const _commands : update_operator_params; const _s : storage) : return is (failwith(fa2_operators_not_supported) : return)
  
  function mint(const p : create_achievement_params; var s : storage) : return is block {
    assert_with_error(Tezos.sender = s.admin, error_access_denied);
    s.last_id := s.last_id + 1n;
    s.token_metadata[s.last_id] := record[token_id=s.last_id; token_info=p.0];
    s.extra[s.last_id] := record[enable=True; expires=(None : option(timestamp)); notbefore=Tezos.now; tokens=p.1;];
  } with (noop, s)

  function set_admin(const p : option(address); var s : storage) : return is block {
    assert_with_error(Tezos.sender = s.admin, error_access_denied);
    s.pending_admin := p;
  } with (noop, s)

  function confirm_admin(var s : storage) : return is block {
    assert_with_error(Some(Tezos.sender) = s.pending_admin, error_not_a_pending_admin);
    s.pending_admin := (None: option(address));
    s.admin := Tezos.sender;
  } with (noop, s)

  function enable_achievement(const p : token_id * bool; var s : storage) : return is block {
    assert_with_error(Tezos.sender = s.admin, error_access_denied);
    var data : token_extra := Option.unopt_with_error(s.extra[p.0], fa2_token_undefined);
    data.enable := p.1;
    s.extra[p.0] := data;
  } with (noop, s)

  function update_achievement(const p : update_achievement_params; var s : storage) : return is block {
    assert_with_error(Tezos.sender = s.admin, error_access_denied);
    var data : token_extra := Option.unopt_with_error(s.extra[p.token_id], fa2_token_undefined);
    data.notbefore := p.notbefore;
    data.expires := p.expires;
    data.tokens := p.tokens;
    s.extra[p.token_id] := data;
  } with (noop, s)

  function update_token_metadata(const p : update_token_metadata_params; var s : storage) : return is block {
    assert_with_error(Tezos.sender = s.admin, error_access_denied);
    var data : token_meta := Option.unopt_with_error(s.token_metadata[p.token_id], fa2_token_undefined);
    data.token_info := p.metadata;
    s.token_metadata[p.token_id] := data;
  } with (noop, s)

  function withdraw_tokens(const p : nat * address; const s : storage) : return is block {
    assert_with_error(Tezos.sender = s.admin, error_access_denied);
  } with (transfer_tokens(p, s), s)

  function register_token_contract(const p : address; var s : storage) : return is block {
    assert_with_error(Tezos.sender = s.admin, error_access_denied);
    s.token := p;
  } with (noop, s)

  function register_signer(const p : key; var s : storage) : return is block {
    assert_with_error(Tezos.sender = s.admin, error_access_denied);
    s.signer := p;
  } with (noop, s)

  function claim_achievement(const p : claim_params; var s : storage) : return is block {
    assert_with_error(Crypto.check(s.signer, p.1, p.0), "Signature is wrong");
    const claim : claim = Option.unopt_with_error((Bytes.unpack(p.0) : option(claim)), "Invalid claim data");
    assert_with_error(claim.1 = Tezos.sender, "Wrong receiver");
    const data : token_extra = Option.unopt_with_error((s.extra[claim.0] : option(token_extra)), "Unknown achievement ID");
    assert_with_error(data.enable, "Achievement disabled");
    assert_with_error(data.notbefore <= Tezos.now, "Achievement is not unlockable yet");
    case (data.expires : option(timestamp)) of [
        | None -> skip
        | Some(t) -> if t < Tezos.now then failwith("Achievement is not claimable any more") else skip
    ];
    s.ledger[(claim.1, claim.0)] := case (s.ledger[(claim.1, claim.0)] : option(nat)) of [
        | None -> 1n
        | Some(_) -> (failwith("Achievement already unlocked") : nat)
    ];
  } with (if data.tokens > 0n then transfer_tokens((data.tokens, Tezos.sender), s) else noop, s)

  function main(const action : action; var s : storage) : return is
    case action of [
      | Balance_of(p) -> fa2_balance_of(p, s)
      | Confirm_admin -> confirm_admin(s)
      | Claim_achievement(p) -> claim_achievement(p, s)
      | Create_achievement(p) -> mint(p, s)
      | Enable_achievement(p) -> enable_achievement(p, s)
      | Register_token_contract(p) -> register_token_contract(p, s)
      | Register_signer(p) -> register_signer(p, s)
      | Set_admin(p) -> set_admin(p, s)
      | Transfer(p) -> fa2_transfer(p, s)
      | Update_achievement(p) -> update_achievement(p, s)
      | Update_operators(p) -> fa2_update_operators(p, s)
      | Update_token_metadata(p) -> update_token_metadata(p, s)
      | Withdraw_tokens(p) -> withdraw_tokens(p, s)
    ]

  [@view]
  function balance_of(const p : list(balance_of_request); const s : storage) : list(balance_of_response) is
    begin
      function get_balance_response (const r : balance_of_request) : balance_of_response is
        record[
          balance = if asset_id = r.token_id then get_balance(r.owner, r.token_id, s) else (failwith(fa2_token_undefined) : amt);
          request = r;
        ];
    end with List.map(get_balance_response, p)