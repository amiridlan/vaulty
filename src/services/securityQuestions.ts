import { getDatabase } from './database';
import { EncryptionService } from './encryption';

export interface SecurityQuestion {
  id: number;
  question: string;
}

export const SECURITY_QUESTIONS: SecurityQuestion[] = [
  { id: 1, question: "What was the name of your first pet?" },
  { id: 2, question: "What is your mother's maiden name?" },
  { id: 3, question: "What city were you born in?" },
  { id: 4, question: "What was the name of your elementary school?" },
  { id: 5, question: "What is your favorite book?" },
];

export class SecurityQuestionService {
  // Save security question and answer during setup
  static async saveSecurityQuestion(
    questionId: number,
    answer: string
  ): Promise<void> {
    const db = await getDatabase();

    // Generate salt and hash answer (case-insensitive)
    const normalizedAnswer = answer.toLowerCase().trim();
    const salt = EncryptionService.generateSalt();
    const answerHash = await EncryptionService.hashMasterPassword(normalizedAnswer, salt);

    // Store in database
    await db.execute(
      'INSERT INTO security_question (id, question_id, answer_hash, answer_salt) VALUES (1, ?, ?, ?)',
      [questionId, answerHash, salt]
    );
  }

  // Check if security question exists
  static async hasSecurityQuestion(): Promise<boolean> {
    const db = await getDatabase();
    const result = await db.select(
      'SELECT * FROM security_question WHERE id = 1'
    );
    return result.length > 0;
  }

  // Get the security question
  static async getSecurityQuestion(): Promise<SecurityQuestion | null> {
    const db = await getDatabase();
    const result = await db.select(
      'SELECT question_id FROM security_question WHERE id = 1'
    ) as any[];

    if (result.length === 0) return null;

    const questionId = result[0].question_id;
    const question = SECURITY_QUESTIONS.find(q => q.id === questionId);

    return question || null;
  }

  // Verify security answer
  static async verifySecurityAnswer(answer: string): Promise<boolean> {
    const db = await getDatabase();
    const result = await db.select(
      'SELECT answer_hash, answer_salt FROM security_question WHERE id = 1'
    ) as any[];

    if (result.length === 0) {
      throw new Error('Security question not set');
    }

    const { answer_hash, answer_salt } = result[0];

    // Hash provided answer with stored salt (case-insensitive)
    const normalizedAnswer = answer.toLowerCase().trim();
    const inputHash = await EncryptionService.hashMasterPassword(normalizedAnswer, answer_salt);

    return inputHash === answer_hash;
  }

  // Reset master password using security question
  static async resetMasterPassword(
    securityAnswer: string,
    newPassword: string
  ): Promise<void> {
    // Verify security answer
    const isValid = await this.verifySecurityAnswer(securityAnswer);
    if (!isValid) {
      throw new Error('Incorrect security answer');
    }

    const db = await getDatabase();

    // WARNING: This deletes all existing data since we can't decrypt it
    // Generate new salt and hash for master password
    const newSalt = EncryptionService.generateSalt();
    const newHash = await EncryptionService.hashMasterPassword(newPassword, newSalt);

    // Update master password
    await db.execute(
      'UPDATE master_password SET password_hash = ?, salt = ? WHERE id = 1',
      [newHash, newSalt]
    );

    // Delete all encrypted data (can't be decrypted without old password)
    await db.execute('DELETE FROM password_owners');
    await db.execute('DELETE FROM password_entries');
  }
}