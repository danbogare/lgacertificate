export interface ISignupPayload {
  firstName: string;
  lastName: string;
  middleName: string;
  email: string;
  phone: string;
  password: string;
}

export interface ITokenPayload {
  id: string;
  email: string;
  state?: string;
  lga?: string;
}
