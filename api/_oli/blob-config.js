export function blobOptions() {
  if (process.env.OLI_BLOB_READ_WRITE_TOKEN) {
    return { access: 'private', token: process.env.OLI_BLOB_READ_WRITE_TOKEN };
  }
  return { access: 'public', token: process.env.BLOB_READ_WRITE_TOKEN };
}
