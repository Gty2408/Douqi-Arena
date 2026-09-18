import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { Piece, PieceAttributes, PieceType, Side } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface PieceRuleConfig {
  type: PieceType;
  count: number;
  defaultName: string;
  movable: boolean;
  canCaptureFlag: boolean;
  canTurnOnRailway?: boolean;
  attributes: PieceAttributes;
}

export interface PieceRulesConfig {
  version: number;
  pieces: PieceRuleConfig[];
  levelBudget: number;
  maxRank: number;
  minRank: number;
  maxNameLength: number;
}

export class PieceRules {
  readonly config: PieceRulesConfig;
  private byType: Map<PieceType, PieceRuleConfig>;

  constructor(config: PieceRulesConfig) {
    this.config = config;
    this.byType = new Map(config.pieces.map((p) => [p.type, p]));
  }

  static load(path?: string): PieceRules {
    const configPath = path ?? join(__dirname, '..', 'data', 'piece-rules.json');
    const raw = readFileSync(configPath, 'utf-8');
    const config = JSON.parse(raw) as PieceRulesConfig;
    return new PieceRules(config);
  }

  getRule(type: PieceType): PieceRuleConfig | undefined {
    return this.byType.get(type);
  }

  get levelBudget(): number {
    return this.config.levelBudget;
  }

  get maxRank(): number {
    return this.config.maxRank;
  }

  get minRank(): number {
    return this.config.minRank;
  }

  get maxNameLength(): number {
    return this.config.maxNameLength;
  }
}

/**
 * Factory that creates pieces for one side based on the rules config.
 * All piece definitions come from the data table — no hardcoded piece chains.
 */
export class PieceFactory {
  private rules: PieceRules;
  private counter = 0;

  constructor(rules: PieceRules) {
    this.rules = rules;
  }

  private genPieceId(side: Side, type: PieceType): string {
    this.counter += 1;
    return `${side}-${type}-${this.counter}`;
  }

  /** Create the full set of 25 pieces for one side. */
  createPieces(side: Side): Piece[] {
    const pieces: Piece[] = [];
    for (const rule of this.rules.config.pieces) {
      for (let i = 0; i < rule.count; i++) {
        pieces.push({
          id: this.genPieceId(side, rule.type),
          type: rule.type,
          side,
          name: rule.defaultName,
          // Deep clone attributes so each piece has its own rank object.
          attributes: { ...rule.attributes },
          alive: true,
          position: null,
        });
      }
    }
    return pieces;
  }

  get rulesRef(): PieceRules {
    return this.rules;
  }
}
