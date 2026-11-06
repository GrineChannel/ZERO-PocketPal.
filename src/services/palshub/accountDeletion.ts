
import {palStore} from '../../store';
import {authService} from './AuthService';
import {getAuthHeaders} from './supabase';
import {syncService} from './SyncService';
import {postAccountDelete} from './accountApi';
import type {DeleteAccountOutcome, DeleteRequestBody} from './accountApi';

const errorName = (error: unknown) => (error as Error)?.name;

// Оставляем тип для совместимости с существующими вызовами.
type DeleteAccountOptions = {
  confirmWithoutApple?: () => Promise<boolean>;
};

const requestBody = async (
  _options: DeleteAccountOptions,
): Promise<DeleteRequestBody> => ({});

const endLocalSession = async () => {
  if (!(await authService.signOut({scope: 'local'}).catch(() => false))) {
    authService.resetLocalSession();
  }
};

const clearAccountData = async () => {
  const steps = [
    endLocalSession,
    () => palStore.clearAccountPals(),
    () => syncService.clearCache(),
  ];

  for (const step of steps) {
    try {
      await step();
    } catch (error) {
      console.warn('Account clean-up step failed:', errorName(error));
    }
  }
};

const requestDeletion = async (
  options: DeleteAccountOptions,
): Promise<DeleteAccountOutcome> => {
  const body = await requestBody(options);

  const {Authorization} = (await getAuthHeaders()) as {
    Authorization?: string;
  };

  if (!Authorization) {
    return {kind: 'sign_in_again'};
  }

  return postAccountDelete(body, Authorization);
};

export const deleteAccount = async (
  options: DeleteAccountOptions = {},
): Promise<DeleteAccountOutcome> => {
  let outcome: DeleteAccountOutcome;

  try {
    outcome = await requestDeletion(options);
  } catch (error) {
    console.warn('Account deletion failed:', errorName(error));
    return {kind: 'failed'};
  }

  if (outcome.kind === 'deleted') {
    await clearAccountData();
  }

  return outcome;
};
