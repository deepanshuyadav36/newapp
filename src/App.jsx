import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

export default function App() {
  const [session, setSession] = useState(null);

  // auth form
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // tasks
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState("");

  // UI helpers
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  // NEW: search + filter
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all"); // all | pending | done

  // NEW: edit state
  const [editingId, setEditingId] = useState(null);
  const [editingTitle, setEditingTitle] = useState("");

  // keep session
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, newSession) => setSession(newSession)
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  // load tasks + realtime
  useEffect(() => {
    if (!session?.user) return;

    fetchTasks();

    const channel = supabase
      .channel("tasks-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks" },
        () => fetchTasks()
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  async function fetchTasks() {
    setLoading(true);
    setMsg("");

    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) setMsg(error.message);
    else setTasks(data || []);
    setLoading(false);
  }

  async function signUp() {
    setMsg("");
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) setMsg(error.message);
    else setMsg("Signup done. Now login.");
  }

  async function signIn() {
    setMsg("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setMsg(error.message);
  }

  async function signOut() {
    await supabase.auth.signOut();
    setTasks([]);
    setQuery("");
    setFilter("all");
    setEditingId(null);
    setEditingTitle("");
  }

  async function addTask(e) {
    e.preventDefault();
    if (!title.trim()) return;

    setMsg("");
    const user_id = session.user.id;

    const { error } = await supabase
      .from("tasks")
      .insert([{ title: title.trim(), user_id }]);

    if (error) setMsg(error.message);
    else setTitle("");
  }

  async function toggleDone(task) {
    setMsg("");
    const { error } = await supabase
      .from("tasks")
      .update({ is_done: !task.is_done })
      .eq("id", task.id);

    if (error) setMsg(error.message);
  }

  async function deleteTask(id) {
    setMsg("");
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) setMsg(error.message);
  }

  // NEW: start edit
  function startEdit(task) {
    setEditingId(task.id);
    setEditingTitle(task.title);
  }

  // NEW: cancel edit
  function cancelEdit() {
    setEditingId(null);
    setEditingTitle("");
  }

  // NEW: save edit
  async function saveEdit(id) {
    const next = editingTitle.trim();
    if (!next) return;

    setMsg("");
    const { error } = await supabase.from("tasks").update({ title: next }).eq("id", id);

    if (error) setMsg(error.message);
    else cancelEdit();
  }

  // NEW: dashboard stats
  const stats = useMemo(() => {
    const total = tasks.length;
    const done = tasks.filter((t) => t.is_done).length;
    const pending = total - done;
    const percent = total === 0 ? 0 : Math.round((done / total) * 100);
    return { total, done, pending, percent };
  }, [tasks]);

  // NEW: search + filter list
  const visibleTasks = useMemo(() => {
    const q = query.trim().toLowerCase();

    return tasks.filter((t) => {
      const matchesQuery = q ? t.title.toLowerCase().includes(q) : true;
      const matchesFilter =
        filter === "all" ? true : filter === "done" ? t.is_done : !t.is_done;

      return matchesQuery && matchesFilter;
    });
  }, [tasks, query, filter]);

  return (
    <div style={{ maxWidth: 760, margin: "40px auto", fontFamily: "system-ui", padding: 16 }}>
      <h2 style={{ marginBottom: 6 }}>Supabase Tasks</h2>

      {msg ? (
        <p style={{ padding: 10, background: "#eee", borderRadius: 8, marginTop: 10 }}>{msg}</p>
      ) : null}

      {!session ? (
        <div style={{ display: "grid", gap: 10, marginTop: 16, maxWidth: 420 }}>
          <input placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input
            placeholder="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={signIn}>Login</button>
            <button onClick={signUp}>Signup</button>
          </div>

          <p style={{ fontSize: 13, opacity: 0.8 }}>
            Tip: keep a strong password (e.g., Test@12345).
          </p>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p style={{ margin: 0 }}>Logged in: <b>{session.user.email}</b></p>
            <button onClick={signOut}>Logout</button>
          </div>

          {/* Dashboard */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gap: 10,
              marginTop: 16,
            }}
          >
            <StatCard label="Total" value={stats.total} />
            <StatCard label="Done" value={stats.done} />
            <StatCard label="Pending" value={stats.pending} />
            <StatCard label="Completion" value={`${stats.percent}%`} />
          </div>

          {/* Add */}
          <form onSubmit={addTask} style={{ marginTop: 16, display: "flex", gap: 8 }}>
            <input
              placeholder="New task..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{ flex: 1 }}
            />
            <button type="submit">Add</button>
          </form>

          {/* Search + Filter */}
          <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
            <input
              placeholder="Search tasks..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ flex: 1, minWidth: 220 }}
            />

            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setFilter("all")}
                style={pillStyle(filter === "all")}
                type="button"
              >
                All
              </button>
              <button
                onClick={() => setFilter("pending")}
                style={pillStyle(filter === "pending")}
                type="button"
              >
                Pending
              </button>
              <button
                onClick={() => setFilter("done")}
                style={pillStyle(filter === "done")}
                type="button"
              >
                Done
              </button>
            </div>
          </div>

          {/* List */}
          <div style={{ marginTop: 16 }}>
            {loading ? <p>Loading...</p> : null}

            {visibleTasks.length === 0 && !loading ? (
              <p style={{ opacity: 0.8 }}>No tasks match your search/filter.</p>
            ) : null}

            {visibleTasks.map((t) => {
              const isEditing = editingId === t.id;

              return (
                <div
                  key={t.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: 12,
                    border: "1px solid #ddd",
                    borderRadius: 12,
                    marginTop: 10,
                    gap: 10,
                  }}
                >
                  <div style={{ display: "flex", gap: 10, alignItems: "center", flex: 1 }}>
                    <input
                      type="checkbox"
                      checked={t.is_done}
                      onChange={() => toggleDone(t)}
                    />

                    {!isEditing ? (
                      <span style={{ textDecoration: t.is_done ? "line-through" : "none" }}>
                        {t.title}
                      </span>
                    ) : (
                      <input
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        style={{ flex: 1 }}
                      />
                    )}
                  </div>

                  {!isEditing ? (
                    <div style={{ display: "flex", gap: 8 }}>
                      <button type="button" onClick={() => startEdit(t)}>
                        Edit
                      </button>
                      <button type="button" onClick={() => deleteTask(t.id)}>
                        Delete
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", gap: 8 }}>
                      <button type="button" onClick={() => saveEdit(t.id)}>
                        Save
                      </button>
                      <button type="button" onClick={cancelEdit
