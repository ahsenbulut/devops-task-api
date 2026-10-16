export interface Task {
  id: string;
  title: string;
  description: string | null;
  completed: boolean;
  createdAt: string;
}

export interface CreateTaskInput {
  title: string;
  description: string | null;
  completed: boolean;
}

export const TITLE_MAX_LENGTH = 200;
export const DESCRIPTION_MAX_LENGTH = 1000;
