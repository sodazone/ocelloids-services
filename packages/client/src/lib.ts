/**
 * A client library for the XCM Monitoring Server.
 *
 * @see {@link OcelloidsClient} to get started.
 *
 * @packageDocumentation
 */

export * from './client'
export * from './types'
export * from './server-types'

// The "export * as ___" syntax is not supported yet; as a workaround,
// use "import * as ___" with a separate "export { ___ }" declaration
import * as xcm from './xcm/types'
export { xcm }

import * as steward from './steward/types'
export { steward }
