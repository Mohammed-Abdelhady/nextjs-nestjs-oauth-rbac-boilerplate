import 'reflect-metadata';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import {
  DEFAULT_STORAGE_KIND,
  STORAGE_KIND,
  STORAGE_KINDS,
  StorageKind,
} from '../common/persistence/storage-choice';
import { transformOptionalString } from '../common/utils/environment-transform';

export const POSTGRES_POOL_MAX_DEFAULT = 10;

/**
 * A number setting left blank in a copied example file is unset, as blank text
 * settings are. Anything else is read as a number and validated as one.
 */
function blankAsDefault(
  fallback: number,
): (params: { value: unknown }) => unknown {
  return ({ value }) =>
    value === undefined || value === null || value === ''
      ? fallback
      : Number(value);
}

/** True when the setting, as given or defaulted, names this database. */
export function runsOn(kind: StorageKind): (environment: object) => boolean {
  return (environment) =>
    (Reflect.get(environment, 'DATABASE_TYPE') ?? DEFAULT_STORAGE_KIND) ===
    kind;
}

/** Which database the server runs on, and how to reach PostgreSQL. */
export class StorageEnvironmentVariables {
  @Transform(transformOptionalString)
  @IsIn([...STORAGE_KINDS])
  @IsOptional()
  DATABASE_TYPE: StorageKind = DEFAULT_STORAGE_KIND;

  /** Required with PostgreSQL, and not read at all with MongoDB. */
  @ValidateIf(runsOn(STORAGE_KIND.POSTGRES))
  @IsString()
  @IsNotEmpty({
    message: 'POSTGRES_URL is required when DATABASE_TYPE is postgres',
  })
  @Matches(/^postgres(ql)?:\/\/.+$/, {
    message:
      'POSTGRES_URL must be a PostgreSQL connection string starting with postgres:// or postgresql://',
  })
  POSTGRES_URL?: string;

  /** Connections the server may hold open at once. */
  @ValidateIf(runsOn(STORAGE_KIND.POSTGRES))
  @Transform(blankAsDefault(POSTGRES_POOL_MAX_DEFAULT))
  @IsInt()
  @Min(1)
  @Max(200)
  @IsOptional()
  POSTGRES_POOL_MAX: number = POSTGRES_POOL_MAX_DEFAULT;
}
