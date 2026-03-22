/**
 * People data management
 */

const DATA_URL = "/people/people.json";

let cachedData = null;

export async function fetchPeopleData() {
  if (cachedData) return cachedData;
  const res = await fetch(DATA_URL);
  cachedData = await res.json();
  return cachedData;
}

export async function getPeopleCount() {
  const data = await fetchPeopleData();
  return data.members.length;
}

export async function getAllMembers() {
  const data = await fetchPeopleData();
  return data.members;
}

export async function getMemberById(id) {
  const data = await fetchPeopleData();
  return data.members.find(m => m.id === id);
}
