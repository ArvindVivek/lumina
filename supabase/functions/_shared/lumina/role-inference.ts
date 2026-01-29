// Multi-signal role inference for champion picks
// File: supabase/functions/_shared/role-inference.ts

import { getChampionRolePrior } from './champion-roles.ts';
import { Role } from './types.ts';

// ==========================================
// TYPES
// ==========================================

export interface RoleInferenceInput {
  championName: string;
  playerPrimaryRole: Role | null; // From roster data (may be missing)
  assignedRoles: Role[]; // Already-assigned roles on the team
}

export interface RoleInferenceResult {
  role: Role;
  confidence: number; // 0.0 to 1.0
  reasoning: string; // For debugging/transparency
}

// ==========================================
// ROLE INFERENCE WEIGHTS
// ==========================================

/**
 * Signal weights for role inference.
 * These weights balance champion distribution data with player role information.
 *
 * - Champion prior: Historical role frequency for this champion (most reliable for pure picks)
 * - Player role: Player's primary role from roster (helps with flex picks)
 * - Constraint: Role is available (not already assigned to teammate)
 */
const WEIGHTS = {
  championPrior: 0.5, // How often this champion plays each role
  playerRole: 0.3, // Player's primary role (if known)
  constraint: 0.2, // Role is available and viable
};

// ==========================================
// ROLE INFERENCE ALGORITHM
// ==========================================

/**
 * Infer the most likely role for a champion pick using multi-signal approach.
 *
 * Algorithm:
 * 1. Get champion role priors (historical distribution)
 * 2. Filter to available roles (not in assignedRoles)
 * 3. Score each available role:
 *    - Champion prior weight: how often champion plays this role
 *    - Player role weight: boost if player's primary role matches
 *    - Constraint bonus: role is available and champion can play it
 * 4. Select highest-scoring role
 * 5. Calculate confidence based on score strength
 *
 * @param input - Champion name, player role, and team constraints
 * @returns Role assignment with confidence and reasoning
 */
export function inferRole(input: RoleInferenceInput): RoleInferenceResult {
  const { championName, playerPrimaryRole, assignedRoles } = input;

  // Get champion role priors (historical distribution)
  const championPriors = getChampionRolePrior(championName);

  // Available roles (not already assigned to teammates)
  const allRoles: Role[] = ['top', 'jungle', 'mid', 'adc', 'support'];
  const availableRoles = allRoles.filter(
    (role) => !assignedRoles.includes(role)
  );

  // Edge case: All roles already assigned (shouldn't happen in valid draft)
  if (availableRoles.length === 0) {
    console.warn(
      `All roles already assigned when inferring ${championName}. Using fallback.`
    );
    return {
      role: 'mid',
      confidence: 0.0,
      reasoning: 'ERROR: All roles assigned (invalid draft state)',
    };
  }

  // Calculate score for each available role
  const roleScores: Record<Role, number> = {} as Record<Role, number>;

  for (const role of availableRoles) {
    let score = 0;

    // Signal 1: Champion prior (0.5 weight)
    const championPriorScore = championPriors[role] || 0;
    score += championPriorScore * WEIGHTS.championPrior;

    // Signal 2: Player role match (0.3 weight)
    if (playerPrimaryRole && role === playerPrimaryRole) {
      // Boost score if player's primary role matches this role
      score += WEIGHTS.playerRole;
    }

    // Signal 3: Constraint satisfaction (0.2 weight)
    // Role is available and champion has non-zero prior
    if (championPriorScore > 0) {
      score += WEIGHTS.constraint;
    }

    roleScores[role] = score;
  }

  // Find highest-scoring role
  let inferredRole: Role = availableRoles[0];
  let maxScore = roleScores[availableRoles[0]];

  for (const role of availableRoles) {
    if (roleScores[role] > maxScore) {
      maxScore = roleScores[role];
      inferredRole = role;
    }
  }

  // Calculate confidence (normalize score to 0.0-1.0 range)
  // Max possible score: championPrior (0.5 * 1.0) + playerRole (0.3) + constraint (0.2) = 1.0
  const maxPossibleScore = WEIGHTS.championPrior + WEIGHTS.playerRole + WEIGHTS.constraint;
  const confidence = Math.min(maxScore / maxPossibleScore, 1.0);

  // Generate reasoning for transparency
  const reasoning = generateReasoning(
    championName,
    inferredRole,
    confidence,
    championPriors[inferredRole] || 0,
    playerPrimaryRole,
    availableRoles
  );

  // Warn on low-confidence assignments
  if (confidence < 0.5) {
    console.warn(
      `Low confidence role inference: ${championName} → ${inferredRole} (${confidence.toFixed(2)})`
    );
  }

  return {
    role: inferredRole,
    confidence,
    reasoning,
  };
}

/**
 * Generate human-readable reasoning for role inference.
 * Used for debugging and transparency in role assignments.
 */
function generateReasoning(
  champion: string,
  role: Role,
  confidence: number,
  championPrior: number,
  playerRole: Role | null,
  availableRoles: Role[]
): string {
  const parts: string[] = [];

  // Champion and role
  parts.push(`${champion} → ${role}`);

  // Confidence
  parts.push(`(conf: ${confidence.toFixed(2)})`);

  // Champion prior
  if (championPrior > 0.8) {
    parts.push(`champion main role (${(championPrior * 100).toFixed(0)}%)`);
  } else if (championPrior > 0.4) {
    parts.push(`champion common role (${(championPrior * 100).toFixed(0)}%)`);
  } else if (championPrior > 0.15) {
    parts.push(`champion flex role (${(championPrior * 100).toFixed(0)}%)`);
  } else {
    parts.push(`champion uncommon role (${(championPrior * 100).toFixed(0)}%)`);
  }

  // Player role match
  if (playerRole === role) {
    parts.push('player role match');
  } else if (playerRole) {
    parts.push(`player role: ${playerRole}`);
  }

  // Constraints
  if (availableRoles.length < 3) {
    parts.push(`limited roles: [${availableRoles.join(', ')}]`);
  }

  return parts.join(', ');
}

// ==========================================
// SELF-TEST (run with `deno run role-inference.ts`)
// ==========================================

if (import.meta.main) {
  console.log('Running role inference self-tests...\n');

  const tests = [
    // Pure picks - should have high confidence
    {
      name: 'Pure ADC pick (Jinx)',
      input: {
        championName: 'Jinx',
        playerPrimaryRole: 'adc' as Role,
        assignedRoles: [] as Role[],
      },
      expected: 'adc' as Role,
      minConfidence: 0.9,
    },
    {
      name: 'Pure Support pick (Thresh)',
      input: {
        championName: 'Thresh',
        playerPrimaryRole: 'support' as Role,
        assignedRoles: [] as Role[],
      },
      expected: 'support' as Role,
      minConfidence: 0.9,
    },
    {
      name: 'Pure Mid pick (Azir)',
      input: {
        championName: 'Azir',
        playerPrimaryRole: 'mid' as Role,
        assignedRoles: [] as Role[],
      },
      expected: 'mid' as Role,
      minConfidence: 0.9,
    },
    {
      name: 'Pure Jungle pick (Lee Sin)',
      input: {
        championName: 'Lee Sin',
        playerPrimaryRole: 'jungle' as Role,
        assignedRoles: [] as Role[],
      },
      expected: 'jungle' as Role,
      minConfidence: 0.9,
    },

    // Flex picks - confidence depends on constraints
    {
      name: 'Flex pick with player role (Swain support)',
      input: {
        championName: 'Swain',
        playerPrimaryRole: 'support' as Role,
        assignedRoles: [] as Role[],
      },
      expected: 'support' as Role,
      minConfidence: 0.6,
    },
    {
      name: 'Flex pick with constraints (Swain top, no support/mid available)',
      input: {
        championName: 'Swain',
        playerPrimaryRole: null,
        assignedRoles: ['support', 'mid', 'adc'] as Role[],
      },
      expected: 'top' as Role,
      minConfidence: 0.4,
    },
    {
      name: 'Flex pick (Syndra mid vs support)',
      input: {
        championName: 'Syndra',
        playerPrimaryRole: 'mid' as Role,
        assignedRoles: [] as Role[],
      },
      expected: 'mid' as Role,
      minConfidence: 0.7,
    },

    // Unknown champion - should use default distribution
    {
      name: 'Unknown champion',
      input: {
        championName: 'UnknownChampion',
        playerPrimaryRole: 'jungle' as Role,
        assignedRoles: [] as Role[],
      },
      expected: 'jungle' as Role,
      minConfidence: 0.3,
    },

    // Edge case: no player role
    {
      name: 'Pure pick without player role (Jinx)',
      input: {
        championName: 'Jinx',
        playerPrimaryRole: null,
        assignedRoles: [] as Role[],
      },
      expected: 'adc' as Role,
      minConfidence: 0.7,
    },

    // Edge case: constrained roles
    {
      name: 'Constrained pick (last role available)',
      input: {
        championName: 'Jinx',
        playerPrimaryRole: 'adc' as Role,
        assignedRoles: ['top', 'jungle', 'mid', 'support'] as Role[],
      },
      expected: 'adc' as Role,
      minConfidence: 0.9,
    },
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    const result = inferRole(test.input);

    const roleMatch = result.role === test.expected;
    const confMatch = result.confidence >= test.minConfidence;

    if (roleMatch && confMatch) {
      console.log(`✅ PASS: ${test.name}`);
      console.log(`   Result: ${result.reasoning}\n`);
      passed++;
    } else {
      console.log(`❌ FAIL: ${test.name}`);
      console.log(`   Expected: ${test.expected} (conf >= ${test.minConfidence})`);
      console.log(`   Got: ${result.role} (conf: ${result.confidence.toFixed(2)})`);
      console.log(`   Reasoning: ${result.reasoning}\n`);
      failed++;
    }
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`Tests: ${passed} passed, ${failed} failed, ${passed + failed} total`);
  console.log(`${'='.repeat(50)}`);

  if (failed > 0) {
    Deno.exit(1);
  }
}
