/**
 * How many full update-or-create passes a pending store attempt makes before
 * it gives up. A duplicate key sends the attempt around once more, so a
 * concurrent delete in that window still ends in a normal write.
 */
export const PENDING_STORE_PASSES = 2;
