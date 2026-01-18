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
    else setMsg("Signup done. Please check email (if required), then login.");
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

  // stats
  const stats = useMemo(() => {
    const total = tasks.length;
    const done = tasks.filter((t) => t.is_done).length;
    const pending = total - done;
    const percent = total === 0 ? 0 : Math.round((done / total) * 100);
    return { total, done, pending, percent };
  }, [tasks]);

  // visible list
  const visibleTasks = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks.filter((t) => {
      const matchesQuery = q ? t.title.toLowerCase().includes(q) : true;
      const matchesFilter =
        filter === "all" ? true : filter === "done" ? t.is_done : !t.is_done;
      return matchesQuery && matchesFilter;
    });
  }, [tasks, query, filter]);

  // AUTH PAGE (same app, pro UI)
  if (!session) {
    return (
      <div className="authWrap">
        <div className="authCard2">
          <div className="authLeft2">
            <div className="brand">
              <div className="brandDot" />
              <div>
                <div className="brandName">Deepanshu</div>
                <div className="brandSub">Supabase Dashboard Demo</div>
              </div>
            </div>

            <h1 className="hero">Welcome 👋</h1>
            <p className="heroP">
              A clean tasks dashboard built with React + Supabase (Auth, RLS, Realtime).
            </p>

            <div className="chips">
              <span className="chip">Auth</span>
              <span className="chip">Postgres</span>
              <span className="chip">RLS</span>
              <span className="chip">Realtime</span>
              <span className="chip">CRUD</span>
            </div>

            <a className="ghost" href="https://supabase.com" target="_blank" rel="noreferrer">
              Learn Supabase →
            </a>
          </div>

          <div className="authRight2">
            <div className="panel">
              <h3 className="panelTitle">Login to continue</h3>

              {msg ? <div className="toast">{msg}</div> : null}

              <label className="lbl">Email</label>
              <input
                className="in"
                placeholder="name@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

              <label className="lbl">Password</label>
              <input
                className="in"
                placeholder="••••••••"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

              <div className="btnRow">
                <button className="btnPrimary" onClick={signIn}>
                  Login
                </button>
                <button className="btnSecondary" onClick={signUp}>
                  Sign up
                </button>
              </div>

              <p className="hint">
                Tip: for 2nd user, use Gmail plus trick: <b>yourmail+2@gmail.com</b>
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // DASHBOARD PAGE
  return (
    <div className="appShell">
      {/* Sidebar */}
      <aside className="side">
        <div className="profile">
          <div className="avatar">{(session.user.email || "U")[0].toUpperCase()}</div>
          <div>
            <div className="pName">{session.user.email.split("@")[0]}</div>
            <div className="pMail">{session.user.email}</div>
          </div>
        </div>

        <nav className="nav">
          <div className="navItem active">Dashboard</div>
          <div className="navItem">Tasks</div>
          <div className="navItem">Analytics</div>
          <div className="navItem">Settings</div>
        </nav>

        <button className="logoutBtn" onClick={signOut}>
          Logout
        </button>
      </aside>

      {/* Main */}
      <main className="main">
        <div className="topbar">
          <div>
            <div className="hTitle">Tasks Dashboard</div>
            <div className="hSub">Search, filter, edit — with Supabase Realtime.</div>
          </div>

          <div className="topRight">
            <input
              className="search"
              placeholder="Search tasks..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="filters">
              <button
                className={`pill ${filter === "all" ? "pillOn" : ""}`}
                onClick={() => setFilter("all")}
                type="button"
              >
                All
              </button>
              <button
                className={`pill ${filter === "pending" ? "pillOn" : ""}`}
                onClick={() => setFilter("pending")}
                type="button"
              >
                Pending
              </button>
              <button
                className={`pill ${filter === "done" ? "pillOn" : ""}`}
                onClick={() => setFilter("done")}
                type="button"
              >
                Done
              </button>
            </div>
          </div>
        </div>

        {msg ? <div className="toast">{msg}</div> : null}

        <div className="grid">
          {/* Center card */}
          <section className="cardBig">
            <div className="cardHead">
              <div>
                <div className="cardTitle">Your Tasks</div>
                <div className="cardSub">Add, update, edit and delete tasks.</div>
              </div>

              <form className="addRow" onSubmit={addTask}>
                <input
                  className="in"
                  placeholder="New task..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
                <button className="btnPrimary" type="submit">
                  Add
                </button>
              </form>
            </div>

            <div className="list">
              {loading ? <div className="loading">Loading...</div> : null}

              {!loading && visibleTasks.length === 0 ? (
                <div className="empty">No tasks match your search/filter.</div>
              ) : null}

              {visibleTasks.map((t) => {
                const isEditing = editingId === t.id;

                return (
                  <div className="taskRow" key={t.id}>
                    <div className="taskLeft">
                      <input
                        type="checkbox"
                        checked={t.is_done}
                        onChange={() => toggleDone(t)}
                      />
                      {!isEditing ? (
                        <div className={`taskText ${t.is_done ? "done" : ""}`}>{t.title}</div>
                      ) : (
                        <input
                          className="in"
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                        />
                      )}
                    </div>

                    {!isEditing ? (
                      <div className="taskBtns">
                        <button className="btnMini" type="button" onClick={() => startEdit(t)}>
                          Edit
                        </button>
                        <button
                          className="btnMini dangerMini"
                          type="button"
                          onClick={() => deleteTask(t.id)}
                        >
                          Delete
                        </button>
                      </div>
                    ) : (
                      <div className="taskBtns">
                        <button className="btnMini" type="button" onClick={() => saveEdit(t.id)}>
                          Save
                        </button>
                        <button className="btnMini" type="button" onClick={cancelEdit}>
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Right stats */}
          <aside className="cardSide">
            <div className="statBox">
              <div className="statLabel">Total</div>
              <div className="statVal">{stats.total}</div>
            </div>
            <div className="statBox">
              <div className="statLabel">Done</div>
              <div className="statVal">{stats.done}</div>
            </div>
            <div className="statBox">
              <div className="statLabel">Pending</div>
              <div className="statVal">{stats.pending}</div>
            </div>
            <div className="statBox">
              <div className="statLabel">Completion</div>
              <div className="statVal">{stats.percent}%</div>
            </div>

            <div className="tipCard">
              <div className="tipTitle">Security</div>
              <div className="tipText">
                RLS ensures each user only accesses their own rows:
                <br />
                <code>user_id = auth.uid()</code>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
