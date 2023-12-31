export interface ApiResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}
