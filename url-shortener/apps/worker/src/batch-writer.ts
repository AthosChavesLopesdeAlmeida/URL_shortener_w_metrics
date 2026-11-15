import { UnrecoverableError } from 'bullmq';
import { clickEvents, type Database } from '@shortener/db';
import { isForeignKeyViolation } from './db-errors';

export type ClickRow = typeof clickEvents.$inferInsert;

type Pending = {
  row: ClickRow;
  resolve: () => void;
  reject: (err: Error) => void;
};

export class BatchWriter {
  private buffer: Pending[] = [];
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly db: Database,
    private readonly opts: { size: number; flushMs: number },
  ) {}

  // A Promise só resolve depois que o lote foi gravado: é isso que mantém o job "pendente"
  // (e, portanto, reentregável) até a linha estar de fato no banco
  add(row: ClickRow): Promise<void> {
    return new Promise((resolve, reject) => {
      this.buffer.push({ row, resolve, reject });

      if (this.buffer.length >= this.opts.size) {
        void this.flush();
      } else if (!this.timer) {
        this.timer = setTimeout(() => void this.flush(), this.opts.flushMs);
      }
    });
  }

  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.buffer.length === 0) return;

    // Troca o buffer ANTES de qualquer await: dois flushes simultâneos não gravam as mesmas linhas
    const batch = this.buffer;
    this.buffer = [];

    try {
      await this.insert(batch.map((p) => p.row));
      for (const p of batch) p.resolve();
    } catch (err) {
      if (isForeignKeyViolation(err)) {
        // Um link excluído derrubaria o lote todo: regrava um a um para isolar o item ruim
        await this.insertOneByOne(batch);
        return;
      }
      for (const p of batch) p.reject(err as Error); // temporário: o BullMQ faz retry de cada job
    }
  }

  private async insert(rows: ClickRow[]) {
    await this.db.insert(clickEvents).values(rows).onConflictDoNothing();
  }

  private async insertOneByOne(batch: Pending[]) {
    for (const p of batch) {
      try {
        await this.insert([p.row]);
        p.resolve();
      } catch (err) {
        p.reject(
          isForeignKeyViolation(err) ? new UnrecoverableError('Link não existe mais') : (err as Error),
        );
      }
    }
  }
}