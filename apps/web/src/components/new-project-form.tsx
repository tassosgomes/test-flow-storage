"use client";

import { FormEvent, useState } from "react";
import { slugify } from "@tfs/schema";
import { createProjectAction } from "@/server/actions";

export function NewProjectForm() {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const data = new FormData();
    data.set("name", name);
    data.set("slug", slug);
    const result = await createProjectAction(data);
    if (result?.error) setError(result.error);
  }

  return (
    <form className="panel" onSubmit={onSubmit}>
      <h2>Novo projeto</h2>
      <label className="field">
        <span>Nome</span>
        <input
          name="name"
          value={name}
          onChange={(event) => {
            const value = event.target.value;
            setName(value);
            if (!touched) setSlug(slugify(value));
          }}
          required
        />
      </label>
      <label className="field">
        <span>Slug</span>
        <input
          name="slug"
          value={slug}
          onChange={(event) => {
            setTouched(true);
            setSlug(slugify(event.target.value));
          }}
          required
        />
      </label>
      {error ? <p className="error">{error}</p> : null}
      <button className="primary" type="submit">
        Criar
      </button>
    </form>
  );
}
