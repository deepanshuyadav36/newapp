import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";
import "./App.css";

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

  // search + filter
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all"); // all | pending | done

  // edit state
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

  function startEdit(task) {
    setEditingId(task.id);
    setEditingTitle(task.title);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingTitle("");
  }

  async function saveEdit(id) {
    const next = editingTitle.trim();
    if (!next) return;

    setMsg("");
    const { error } = await supabase.from("tasks").update({ title: next }).eq("id", id);

    if (error) setMsg(error.message);
    else cancelEdit();
  }

  const stats = useMemo(() => {
    const total = tasks.length;
    const done = tasks.filter((t) => t.is_done).length;
    const pending = total - done;
    const percent = total === 0 ? 0 : Math.round((done / total) * 100);
    return { total, done, pending, percent };
  }, [tasks]);

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
    <div className="container">
      <div className="header">
        <div>
          <h1 className="title">Supabase Tasks</h1>
          <p className="sub">Auth • Postgres • RLS • Realtime • CRUD • Search • Edit</p>
        </div>

        {session ? (
          <div className="badge">
            <span className="muted">Logged in:</span>
            <b>{session.user.email}</b>
          </div>
        ) : null}
      </div>

      {msg ? <div className="msg">{msg}</div> : null}

      {!session ? (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="section">
            <div className="row">
              <input
                style={{ flex: 1, minWidth: 220 }}
                placeholder="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <input
                style={{ flex: 1, minWidth: 220 }}
                placeholder="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div className="row" style={{ marginTop: 12 }}>
              <button className="primary" onClick={signIn}>
                Login
              </button>
              <button onClick={signUp}>Signup</button>
            </div>

            <p className="sub" style={{ marginTop: 12 }}>
              Tip: use Gmail plus trick for 2nd user: <b>yourmail+2@gmail.com</b>
            </p>
          </div>
        </div>
      ) : (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="section">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <div className="badge">
                <span className="muted">Security:</span>
                <span>RLS ensures each user only sees their own tasks</span>
              </div>
              <button onClick={signOut}>Logout</button>
            </div>

            <div className="stats">
              <StatCard label="Total" value={stats.total} />
              <StatCard label="Done" value={stats.done} />
              <StatCard label="Pending" value={stats.pending} />
              <StatCard label="Completion" value={`${stats.percent}%`} />
            </div>

            <hr className="sep" style={{ marginTop: 16 }} />

            <form onSubmit={addTask} className="row" style={{ marginTop: 16 }}>
              <input
                style={{ flex: 1, minWidth: 240 }}
                placeholder="New task..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <button className="primary" type="submit">
                Add
              </button>
            </form>

            <div className="row" style={{ marginTop: 12 }}>
              <input
                style={{ flex: 1, minWidth: 240 }}
                placeholder="Search tasks..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />

              <button
                className={`pill ${filter === "all" ? "active" : ""}`}
                type="button"
                onClick={() => setFilter("all")}
              >
                All
              </button>
              <button
                className={`pill ${filter === "pending" ? "active" : ""}`}
                type="button"
                onClick={() => setFilter("pending")}
              >
                Pending
              </button>
              <button
                className={`pill ${filter === "done" ? "active" : ""}`}
                type="button"
                onClick={() => setFilter("done")}
              >
                Done
              </button>
            </div>

            <div style={{ marginTop: 16 }}>
              {loading ? <p className="muted">Loading...</p> : null}

              {visibleTasks.length === 0 && !loading ? (
                <p className="muted">No tasks match your search/filter.</p>
              ) : null}

              {visibleTasks.map((t) => {
                const isEditing = editingId === t.id;

                return (
                  <div className="task" key={t.id}>
                    <div className="taskLeft">
                      <input type="checkbox" checked={t.is_done} onChange={() => toggleDone(t)} />

                      {!isEditing ? (
                        <span
                          className="taskTitle"
                          style={{ textDecoration: t.is_done ? "line-through" : "none" }}
                        >
                          {t.title}
                        </span>
                      ) : (
                        <input
                          style={{ flex: 1 }}
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                        />
                      )}
                    </div>

                    {!isEditing ? (
                      <div className="row" style={{ gap: 8 }}>
                        <button type="button" onClick={() => startEdit(t)}>
                          Edit
                        </button>
                        <button
                          className="danger"
                          type="button"
                          onClick={() => deleteTask(t.id)}
                        >
                          Delete
                        </button>
                      </div>
                    ) : (
                      <div className="row" style={{ gap: 8 }}>
                        <button className="primary" type="button" onClick={() => saveEdit(t.id)}>
                          Save
                        </button>
                        <button type="button" onClick={cancelEdit}>
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
    </div>
  );
}
