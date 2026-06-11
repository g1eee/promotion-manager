"use client";

import { useCallback, useEffect, useId, useState } from "react";
import {
  Button,
  Card,
  Field,
  Spinner,
  Stack,
  Textarea,
  useToast,
} from "@ui/components";
import type { FeedbackRecord } from "@domain/types";

interface ApiErrorBody {
  message?: string;
}

class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiErrorBody,
  ) {
    super(body.message ?? "Terjadi kesalahan.");
    this.name = "ApiError";
  }
}

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  const data = text ? (JSON.parse(text) as unknown) : null;
  if (!response.ok) {
    throw new ApiError(response.status, (data as ApiErrorBody) ?? {});
  }
  return data as T;
}

function formatDateTime(value: Date | string): string {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export interface FeedbackThreadProps {
  /** Promo Reference (Promo_Scenario id) the thread belongs to. */
  readonly promoId: string;
}

/**
 * Two-way Feedback discussion thread for a promo (Req 14.4–14.6).
 *
 * Renders every {@link FeedbackRecord} oldest-first with its Created By User and
 * Created Date, plus a form to append a new note. The form is shown for any role
 * with access to the promo (SPV_Marketing and Admin_Marketplace) — the API gates
 * creation via RBAC (Req 1.5), so both roles can participate in the thread.
 */
export function FeedbackThread({ promoId }: FeedbackThreadProps) {
  const toast = useToast();
  const messageField = useId();
  const [records, setRecords] = useState<FeedbackRecord[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadThread = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const thread = await readJson<FeedbackRecord[]>(
        await fetch(`/api/promos/${promoId}/feedback`, { cache: "no-store" }),
      );
      setRecords(thread);
    } catch (error) {
      setLoadError(
        error instanceof ApiError ? error.message : "Gagal memuat Feedback.",
      );
    } finally {
      setLoading(false);
    }
  }, [promoId]);

  useEffect(() => {
    void loadThread();
  }, [loadThread]);

  const submitFeedback = useCallback(async () => {
    if (message.trim() === "") {
      return;
    }
    setSubmitting(true);
    try {
      const created = await readJson<FeedbackRecord>(
        await fetch(`/api/promos/${promoId}/feedback`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ message: message.trim() }),
        }),
      );
      setRecords((current) => [...current, created]);
      setMessage("");
      toast.success("Feedback ditambahkan.");
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Gagal menambah Feedback.",
      );
    } finally {
      setSubmitting(false);
    }
  }, [message, promoId, toast]);

  return (
    <Card title="Feedback" subtitle="Diskusi dua arah untuk promo ini">
      <Stack gap="md">
        {loading ? (
          <Stack direction="horizontal" align="center" gap="sm">
            <Spinner size="sm" />
            <span className="pms-muted">Memuat feedback...</span>
          </Stack>
        ) : loadError ? (
          <p className="pms-feedback__error">{loadError}</p>
        ) : records.length === 0 ? (
          <p className="pms-muted">
            Belum ada feedback. Mulai diskusi di bawah ini.
          </p>
        ) : (
          <ul className="pms-feedback__thread">
            {records.map((record) => (
              <li key={record.id} className="pms-feedback__item">
                <div className="pms-feedback__meta">
                  <strong>{record.createdByUser}</strong>
                  <span className="pms-muted">
                    {formatDateTime(record.createdDate)}
                  </span>
                </div>
                <p className="pms-feedback__message">{record.message}</p>
              </li>
            ))}
          </ul>
        )}

        <Field htmlFor={messageField} label="Tambah Feedback">
          <Textarea
            id={messageField}
            rows={3}
            value={message}
            placeholder="Tulis feedback untuk promo ini..."
            disabled={submitting}
            onChange={(event) => setMessage(event.target.value)}
          />
        </Field>
        <Stack direction="horizontal" justify="flex-end">
          <Button
            disabled={submitting || message.trim() === ""}
            onClick={() => void submitFeedback()}
          >
            {submitting ? "Mengirim..." : "Kirim Feedback"}
          </Button>
        </Stack>
      </Stack>
    </Card>
  );
}
