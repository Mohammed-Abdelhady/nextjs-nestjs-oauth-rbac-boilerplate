import { Query } from 'mongoose';
import { LINEARIZABLE_QUERY_MAX_TIME_MS } from '../../constants/session-policy';

export function linearizable<Result, Doc>(
  query: Query<Result, Doc>,
): Query<Result, Doc> {
  return query
    .read('primary')
    .readConcern('linearizable')
    .maxTimeMS(LINEARIZABLE_QUERY_MAX_TIME_MS);
}
