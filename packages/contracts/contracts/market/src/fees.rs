//! Fee calculation helpers for the BlueCollar Market contract.
//!
//! All fee arithmetic is saturating/checked to prevent overflow panics.

/// Compute the protocol fee and net worker amount from a gross `amount`.
///
/// # Parameters
/// - `amount`: Gross amount before fee deduction.
/// - `fee_bps`: Protocol fee in basis points (0–500).
///
/// # Returns
/// `(fee, net)` where `fee + net == amount`.
///
/// # Panics
/// Panics with `"Fee overflow"` if the intermediate product overflows `i128`.
pub fn split_fee(amount: i128, fee_bps: u32) -> (i128, i128) {
    let fee: i128 = amount
        .checked_mul(fee_bps as i128)
        .and_then(|v| v.checked_div(10_000))
        .expect("Fee overflow");
    let net = amount.checked_sub(fee).expect("Fee underflow");
    (fee, net)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_split_fee_zero_bps() {
        let (fee, net) = split_fee(100_000, 0);
        assert_eq!(fee, 0);
        assert_eq!(net, 100_000);
    }

    #[test]
    fn test_split_fee_100_bps() {
        let (fee, net) = split_fee(100_000, 100);
        assert_eq!(fee, 1_000);
        assert_eq!(net, 99_000);
    }

    #[test]
    fn test_split_fee_500_bps() {
        // max fee = 5%
        let (fee, net) = split_fee(100_000, 500);
        assert_eq!(fee, 5_000);
        assert_eq!(net, 95_000);
    }

    #[test]
    fn test_split_fee_rounds_down() {
        // 1 token with 100 bps → fee = 0 (rounds toward zero)
        let (fee, net) = split_fee(1, 100);
        assert_eq!(fee, 0);
        assert_eq!(net, 1);
    }

    #[test]
    fn test_split_fee_amounts_sum_to_original() {
        for bps in [0u32, 50, 100, 250, 500] {
            let amount = 999_999i128;
            let (fee, net) = split_fee(amount, bps);
            assert_eq!(fee + net, amount);
        }
    }
}
