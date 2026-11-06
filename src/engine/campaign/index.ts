/**
 * Campaign Subsystem Registry & Feature Gate Facade
 * 
 * Centralizes access and lifecycle management for Age of Sovereignty campaign modules.
 * Gated modules are kept isolated behind explicit configuration to prevent unlinked
 * state drift and AI context confusion.
 */

// Active Campaign Modules (Integrated with Worker / UI)
export * from './realm';
export * from './settlements';
export * from './districts';
export * from './blacksmith';
export * from './ledger';
export * from './couplings';
export * from './experiments';
export * from './patron';
export * from './victories';
export * from './builtWorks';
export * from './influence';
export * from './missions';
export * from './correspondence';

// Dormant / Future Expansion Subsystems
export * as Bounties from './bounties';
export * as Incursions from './incursions';
export * as Dispatches from './dispatches';
export * as CodexExchange from './codexExchange';
export * as Petitioners from './petitioners';
export * as DeepMine from './deepMine';
export * as Harbour from './harbour';
export * as HexMap from './hexMap';
export * as Notables from './notables';
export * as Hires from './hires';
export * as AgeProgress from './ageProgress';
export * as AgeTransitions from './ageTransitions';
