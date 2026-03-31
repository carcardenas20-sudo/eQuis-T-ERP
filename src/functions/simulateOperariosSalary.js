export async function simulateOperariosSalary(params) {
  try {
    const response = await fetch('/api/functions/simulateOperariosSalary', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('equist_token') || ''}`,
      },
      body: JSON.stringify(params || {}),
    });
    if (response.ok) {
      return { status: 200, ...(await response.json()) };
    }
    return { status: response.status };
  } catch (e) {
    console.warn('[simulateOperariosSalary] Error:', e);
    return { status: 500, error: e.message };
  }
}
