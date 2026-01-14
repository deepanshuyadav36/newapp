import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

export default function App() {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, newSession) => setSession(newSession)
    );

    return () => listener.subscription.unsubscribe();
  }, []);

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
    else setMsg("Signup done. If email confirmation is ON, confirm from email.");
  }

  async function signIn() {
    setMsg("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setMsg(error.message);
  }

  async function signOut() {
    await supabase.auth.signOut();
    setTasks([]);
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

  return (
    <div style={{ maxWidth: 560, margin: "40px auto", fontFamily: "system-ui" }}>
      <h2>Supabase Tasks</h2>

      {msg ? (
        <p style={{ padding: 10, background: "#eee", borderRadius: 8 }}>{msg}</p>
      ) : null}

      {!session ? (
        <div style={{ display: "grid", gap: 10 }}>
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
        </div>
      ) : (
        <>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <p style={{ margin: 0 }}>Logged in: {session.user.email}</p>
            <button onClick={signOut}>Logout</button>
          </div>

          <form onSubmit={addTask} style={{ marginTop: 16, display: "flex", gap: 8 }}>
            <input
              placeholder="New task..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{ flex: 1 }}
            />
            <button type="submit">Add</button>
          </form>

          <div style={{ marginTop: 16 }}>
            {loading ? <p>Loading...</p> : null}

            {tasks.map((t) => (
              <div
                key={t.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: 10,
                  border: "1px solid #ddd",
                  borderRadius: 10,
                  marginTop: 10,
                }}
              >
                <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <input type="checkbox" checked={t.is_done} onChange={() => toggleDone(t)} />
                  <span style={{ textDecoration: t.is_done ? "line-through" : "none" }}>
                    {t.title}
                  </span>
                </label>

                <button onClick={() => deleteTask(t.id)}>Delete</button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

