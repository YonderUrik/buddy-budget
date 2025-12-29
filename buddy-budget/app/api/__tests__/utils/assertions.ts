/**
 * Assertion helpers for API response testing
 */

/**
 * Assert that a response has the expected status and optionally matches data
 */
export async function expectJsonResponse(
  response: Response,
  expectedStatus: number,
  expectedData?: any,
) {
  expect(response.status).toBe(expectedStatus);

  const data = await response.json();

  if (expectedData) {
    expect(data).toMatchObject(expectedData);
  }

  return data;
}

/**
 * Assert that a response is an error with the expected status and message
 */
export async function expectErrorResponse(
  response: Response,
  expectedStatus: number,
  expectedErrorMessage?: string,
) {
  expect(response.status).toBe(expectedStatus);

  const data = await response.json();

  expect(data).toHaveProperty("error");

  if (expectedErrorMessage) {
    expect(data.error).toBe(expectedErrorMessage);
  }

  return data;
}
