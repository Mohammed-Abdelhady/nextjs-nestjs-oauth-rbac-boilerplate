import { baseApi } from '@/store/api/baseApi';
import type { LoginResponse } from '@/modules/auth/types/auth.types';
import { PASSKEY_PATHS, passkeyPath } from '../constants';
import type {
  PasskeyListResponse,
  PasskeyLoginRequest,
  PasskeySummary,
  PasskeyTwoFactorRequest,
  RegisterPasskeyRequest,
  RenamePasskeyRequest,
} from '../types';
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from '../utils/webauthn';

/**
 * WebAuthn credentials on an account, and the two-legged ceremonies around
 * them.
 *
 * Every ceremony is a pair: an options call that leaves a five minute
 * challenge cookie, then a verify call the browser's answer goes to. The login
 * pair runs without a session, which is why the cookie rather than the account
 * ties the halves together.
 */
export const passkeysApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getPasskeys: builder.query<PasskeySummary[], void>({
      query: () => ({ url: PASSKEY_PATHS.LIST, method: 'GET' }),
      transformResponse: (response: { success: boolean; data: PasskeyListResponse }) =>
        response.data.passkeys,
      providesTags: ['Passkeys'],
    }),

    createPasskeyOptions: builder.mutation<PublicKeyCredentialCreationOptionsJSON, void>({
      query: () => ({ url: PASSKEY_PATHS.REGISTER_OPTIONS, method: 'POST' }),
      transformResponse: (response: {
        success: boolean;
        data: PublicKeyCredentialCreationOptionsJSON;
      }) => response.data,
    }),

    registerPasskey: builder.mutation<PasskeySummary, RegisterPasskeyRequest>({
      query: (body) => ({ url: PASSKEY_PATHS.REGISTER_VERIFY, method: 'POST', body }),
      transformResponse: (response: { success: boolean; data: PasskeySummary }) => response.data,
      invalidatesTags: ['Passkeys', 'User'],
    }),

    renamePasskey: builder.mutation<PasskeySummary, RenamePasskeyRequest>({
      query: ({ id, name }) => ({ url: passkeyPath(id), method: 'PATCH', body: { name } }),
      transformResponse: (response: { success: boolean; data: PasskeySummary }) => response.data,
      invalidatesTags: ['Passkeys'],
    }),

    deletePasskey: builder.mutation<{ message: string }, string>({
      query: (id) => ({ url: passkeyPath(id), method: 'DELETE' }),
      transformResponse: (response: { success: boolean; data: { message: string } }) =>
        response.data,
      invalidatesTags: ['Passkeys', 'User'],
    }),

    createPasskeyLoginOptions: builder.mutation<PublicKeyCredentialRequestOptionsJSON, void>({
      query: () => ({ url: PASSKEY_PATHS.LOGIN_OPTIONS, method: 'POST', body: {} }),
      transformResponse: (response: {
        success: boolean;
        data: PublicKeyCredentialRequestOptionsJSON;
      }) => response.data,
    }),

    signInWithPasskey: builder.mutation<LoginResponse, PasskeyLoginRequest>({
      query: (body) => ({ url: PASSKEY_PATHS.LOGIN_VERIFY, method: 'POST', body }),
      transformResponse: (response: { success: boolean; data: LoginResponse }) => response.data,
      invalidatesTags: ['Auth', 'User'],
    }),

    answerTwoFactorWithPasskey: builder.mutation<LoginResponse, PasskeyTwoFactorRequest>({
      query: (body) => ({ url: PASSKEY_PATHS.TWO_FACTOR_VERIFY, method: 'POST', body }),
      transformResponse: (response: { success: boolean; data: LoginResponse }) => response.data,
      invalidatesTags: ['Auth', 'User'],
    }),
  }),
});

export const {
  useGetPasskeysQuery,
  useCreatePasskeyOptionsMutation,
  useRegisterPasskeyMutation,
  useRenamePasskeyMutation,
  useDeletePasskeyMutation,
  useCreatePasskeyLoginOptionsMutation,
  useSignInWithPasskeyMutation,
  useAnswerTwoFactorWithPasskeyMutation,
} = passkeysApi;
