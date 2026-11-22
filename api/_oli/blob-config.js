export function blobOptions() {
  return {
    // A fallback token must still point to a store that accepts private blobs.
    access: 'private',
    token: process.env.OLI_BLOB_READ_WRITE_TOKEN || process.env.BLOB_READ_WRITE_TOKEN
  };
}
