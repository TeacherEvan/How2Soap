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

// Dormant / Future Expansion Subsystems (archived to ./dormant/)
// See ./dormant/README.md for reactivation checklist
// export * as Bounties from './dormant/bounties';
// export * as Incursions from './dormant/incursions';
// export * as Dispatches from './dormant/dispatches';
// export * as CodexExchange from './dormant/codexExchange';
// export * as Petitioners from './dormant/petitioners';
// export * as DeepMine from './dormant/deepMine';
// export * as Harbour from './dormant/harbour';
// export * as HexMap from './hexMap';
// export * as Notables from './dormant/notables';
// export * as Hires from './dormant/hires';
// export * as AgeProgress from './dormant/ageProgress';
// export * as AgeTransitions from './dormant/ageTransitions';
