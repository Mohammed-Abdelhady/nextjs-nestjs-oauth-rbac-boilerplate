import { Query } from 'mongoose';

export function linearizable<Result, Doc>(
  query: Query<Result, Doc>,
): Query<Result, Doc> {
  return query.read('primary').readConcern('linearizable');
}
