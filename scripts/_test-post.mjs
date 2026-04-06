const OLD_URL = 'https://script.google.com/macros/s/AKfycbyPArHul2llNlpy2YIW9-4X1G6AQSLmYw9jPpUoGx_KdAhIwcR_-ebRme6b0EVk7znUDw/exec';
const WRONG_URL = 'https://script.google.com/macros/s/AKfycbxC1tTVJEWrc7LsnwqsnuCrqUNLV_FZkE4Q3AKq-PtjBN0ZNSdC-IncGa0BqjbzzIBakQ/exec';

async function testPost(label, url) {
  console.log(`\n=== ${label} ===`);
  const body = new URLSearchParams({ email: 'smoketest@saverx-test.com', drug: 'Repatha', source: 'CLI Test' }).toString();
  const res = await fetch(url, { method: 'POST', headers: {'Content-Type':'application/x-www-form-urlencoded'}, body, redirect:'follow' });
  const text = await res.text();
  console.log('Status:', res.status);
  console.log('Body:', text.slice(0, 200));
}

await testPost('OLD URL (original drug data + forms script)', OLD_URL);
await testPost('CURRENT SAVERX_FORM_API (repatha enrollment script)', WRONG_URL);
