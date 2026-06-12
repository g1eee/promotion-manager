"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Button,
  Card,
  Field,
  Input,
  PageHeader,
  Stack,
  useToast,
} from "@ui/components";

interface UserProfile {
  id: string;
  name: string;
  email: string;
}

export function AccountSettingsView() {
  const toast = useToast();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/users/me");
        const data: UserProfile = await res.json();
        setProfile(data);
        setName(data.name);
      } catch {
        toast.error("Gagal memuat profil.");
      } finally {
        setLoading(false);
      }
    })();
  }, [toast]);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) throw new Error("Gagal menyimpan.");
      const updated: UserProfile = await res.json();
      setProfile(updated);
      toast.success("Profil berhasil diperbarui.");
    } catch {
      toast.error("Gagal menyimpan profil.");
    } finally {
      setSaving(false);
    }
  }, [name, toast]);

  if (loading) {
    return <Card title="Memuat profil..."><p className="pms-muted">Memuat data profil...</p></Card>;
  }

  return (
    <Stack gap="lg">
      <PageHeader title="Account Settings" subtitle="Kelola profil akun Anda." />

      <Card title="Profil">
        <Stack gap="md">
          <Field label="Email">
            <Input value={profile?.email ?? ""} disabled />
          </Field>
          <Field label="Nama">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nama tampilan"
            />
          </Field>
          <div>
            <Button disabled={saving || !name.trim()} onClick={save}>
              {saving ? "Menyimpan..." : "Simpan"}
            </Button>
          </div>
        </Stack>
      </Card>
    </Stack>
  );
}
