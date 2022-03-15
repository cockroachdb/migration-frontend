
export interface Import {
  id: string;
  unix_nano: number;
  import_metadata: ImportMetadata;
}

export interface ImportMetadata {
  statements: ImportStatement[];
  status: string;
  message: string;
  database: string;
}

export interface ImportStatement {
  original: string;
  cockroach: string;
  issues: ImportIssue[];
}

export interface ImportIssue {
  level: string;
  text: string;
  id: string;
  type: string;
}
