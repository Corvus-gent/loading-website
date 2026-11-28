import {get, put, BlobPreconditionFailedError} from '@vercel/blob';

function options() {
  const token = process.env.WEEK_BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error('Week storage unavailable');
  return {access:'private', token};
}

export async function readRecord(name) {
  const result = await get('week/' + name + '.json', {...options(), useCache:false});
  if (!result) return {data:null, etag:null};
  return {data:await new Response(result.stream).json(), etag:result.blob.etag};
}

// Return false when another request committed before us. Readers always go to origin.
export async function writeRecord(name, data, etag) {
  try {
    await put('week/' + name + '.json', JSON.stringify(data), {
      ...options(), contentType:'application/json', addRandomSuffix:false,
      ...(etag ? {ifMatch:etag} : {allowOverwrite:false})
    });
    return true;
  } catch (err) {
    if (err instanceof BlobPreconditionFailedError || (!etag && /already exists/i.test(err.message))) return false;
    throw err;
  }
}
