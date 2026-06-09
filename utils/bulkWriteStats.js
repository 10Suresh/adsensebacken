function fromBulkWriteResult(result, processed = 0) {
  if (!result) {
    return { processed, inserted: 0, modified: 0, upserted: 0 };
  }
  return {
    processed,
    inserted: result.insertedCount ?? 0,
    modified: result.modifiedCount ?? 0,
    upserted: result.upsertedCount ?? 0,
  };
}

function addDbStats(target, stats) {
  if (!stats) return;
  target.processed += stats.processed || 0;
  target.inserted += stats.inserted || 0;
  target.modified += stats.modified || 0;
  target.upserted += stats.upserted || 0;
}

function formatDbStats(stats) {
  if (!stats) return "Processed: 0 | New: 0 | Updated: 0";
  return `Processed: ${stats.processed} | New: ${stats.upserted} | Updated: ${stats.modified}`;
}

module.exports = { fromBulkWriteResult, addDbStats, formatDbStats };
