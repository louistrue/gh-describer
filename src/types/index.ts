export interface Repository {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  owner: {
    login: string;
  };
  private: boolean;
  html_url: string;
  default_branch: string;
  size: number;
  language: string | null;
  topics: string[];
  stargazers_count: number;
  forks_count: number;
}

export interface FileContent {
  path: string;
  content: string;
  size: number;
}

export interface RepoAnalysis {
  repo: Repository;
  files: FileContent[];
  summary: string;
  languages: string[];
  mainPurpose: string;
}

export interface LLMResponse {
  model: string;
  description: string;
  reasoning?: string;
}

export interface DescriptionSuggestion {
  repo: Repository;
  current: string | null;
  suggestions: LLMResponse[];
  selected?: string;
}

export interface LLMConfig {
  name: string;
  model: string;
  temperature?: number;
}

export interface AppConfig {
  githubToken: string;
  openRouterApiKey: string;
  githubUsername?: string;
}

export interface BatchProcessResult {
  repo: Repository;
  success: boolean;
  oldDescription: string | null;
  newDescription: string | null;
  error?: string;
}
