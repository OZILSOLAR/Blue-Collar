/**
 * Centralised validators module.
 *
 * All Zod schemas for request validation are defined in `src/validations/`
 * and re-exported from here so routes and controllers can import from a
 * single, predictable location.
 *
 * The `validate` middleware and Stellar helpers are also re-exported so
 * callers need only one import.
 *
 * Usage:
 *   import { validate, loginRules, createWorkerRules } from '../validators/index.js'
 *   router.post('/login', validate(loginRules), login)
 */
export * from '../validations/index.js'
export { validate, walletAddressSchema, stellarAmountSchema, boundedString } from '../middleware/validate.js'
