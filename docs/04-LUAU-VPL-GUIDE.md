# PORT BIBLE 04 — LUAU VPL TRANSLATION GUIDE

> **Source:** `src/maker/` — the Tile Engine: `TileProgram.js` (node tree),
> `TileCompiler.js` (validates + compiles to bytecode), `TileVM.js`
> (cooperative-coroutine VM), `GameWorldAdapter.js` (sensor reads),
> `primitives.js` (capability schema — THE CONTRACT), `VirtualRobot.js`
> (physics sim), `FirmwareGen.js` (Arduino/MicroPython export).
>
> This guide ports the **visual programming language (tiles)** to **Luau**
> for the Roblox port. Two viable strategies are documented: **A) interpret**
> (port the VM 1:1) and **B) compile tiles → Luau source** (run native). Both
> must preserve the semantics below exactly — the tile language is the
> product's educational core.

---

## 1. TILE PROGRAM MODEL (what must be preserved)

```jsonc
// TileProgram (maker/TileProgram.js:44-120)
{
  "name": "Untitled Brain",
  "brain": "tin" | "spark" | "vision",      // tier gates sensors/actuators
  "nodes": [ /* root-level nodes, executed top→bottom */ ],
  "meta": { "author", "createdAt", "remixOf", ... },
  "version": 1
}
```

### 1.1 Node types (`TileProgram.js:50-91`)
| Node | Fields | Semantics |
|------|--------|-----------|
| `action` | `prim`, `params` | run actuator once (params validated against prim schema) |
| `wait` | `seconds` | pause N seconds (yields the frame; actuators keep state) |
| `repeat` | `count`, `body` | counted loop — **runs to completion within one tick** |
| `forever` | `body` | endless loop — **one pass per tick** (yields at end) |
| `if` / `if_else` | `cond`, `body`, `elseBody` | condition = sensor cmp value |
| `cond` | `sensor`, `cmp`, `value` | `cmp ∈ gt|lt|gte|lte|eq|neq|is`; sensors are analog (0..1) or digital (bool) |
| `not` | — | negates a cond |
| `repeat_until` | `cond`, `body` | run body until cond true (= while !cond), **yields one tick per pass** |
| `wait_until` | `cond` | yield each tick until cond true (repeat_until w/ empty body) |
| `break` | — | exit enclosing forever/repeat immediately |
| `set_var` / `change_var` | `name`, `value`/`delta` | variable tiles (Data Head skill, Lv6) |
| `varCond` / `varVsCond` | `name`, `cmp`, `value`/`otherName` | compare variable |
| `random_var` | `name`, `min`, `max` | random integer in range |
| `read_sensor` | `name`, `sensor` | capture sensor numeric value into var |
| `math_var` | `name`, `op`, `operand` | `op ∈ add|sub|mul|div` |
| `print` | `name` | emit var to HUD/serial |
| `comment` | `text` | non-executing |
| `macro` | `kind`, `params` | intent tile → expanded to primitives by compiler (`TileCompiler.js:246`) |

### 1.2 Execution semantics (THE part to get right) (`TileVM.js:1-30`)
- **Cooperative coroutine**, tick-driven: `step(dt)` called once per game frame.
- `wait N`: sets `waitRemaining = N`, yields; decremented per tick; actuators
  (motors) **stay set while waiting** — motion continues via physics tick.
- `forever`: executes exactly **one pass per tick**, then yields to the frame.
- `repeat N`: executes to completion **within one tick** (budget-bounded).
- `repeat_until`: one iteration per tick, then re-checks.
- Instruction budget (`budget--` in the step loop) prevents runaway programs.
- `break` exits the enclosing loop immediately.
- Conditions compare against a live sensor read; digital sensors are bools,
  analog are normalized 0..1.

---

## 2. STRATEGY A — INTERPRET (port TileVM to Luau, 1:1)

Best for: fidelity + dynamic editing (change tiles mid-run), simpler save
compat (the JSON tile tree is the save format, `?brain=` base64 share links).

### 2.1 Module skeleton
```lua
-- TileVM.lua (port of TileVM.js)
local TileVM = {}
TileVM.__index = TileVM

function TileVM.new(program, adapter, opts)
    local self = setmetatable({}, TileVM)
    self.nodes = program.nodes            -- tile tree (from saved JSON)
    self.adapter = adapter                -- sensor/actuator interface
    self.ip = 1                           -- instruction pointer
    self.waitRemaining = 0
    self.halted = false
    self.vars = {}                        -- variable tiles
    self.budget = opts and opts.budget or 256
    return self
end

function TileVM:step(dt)
    if self.halted then return end
    if self.waitRemaining > 0 then
        self.waitRemaining = self.waitRemaining - dt
        return                                -- actuators stay latched
    end
    local budget = self.budget
    self.yielded = false
    while not self.yielded and not self.halted and budget > 0 do
        budget = budget - 1
        self:execNode(self.nodes[self.ip])    -- one root node
    end
end
```

### 2.2 Node dispatcher (mirror of the JS `switch`)
```lua
function TileVM:execNode(n)
    if n.type == "action" then
        self.adapter:actuate(n.prim, n.params)          -- set motor/led/beep…
        self.ip = self.ip + 1
    elseif n.type == "wait" then
        self.waitRemaining = n.seconds
        self.yielded = true
    elseif n.type == "forever" then
        -- one pass per tick: run body, then loop back to self
        self:execBody(n.body)
        self.yielded = true                             -- yield to frame
    elseif n.type == "repeat" then
        for _ = 1, n.count do self:execBody(n.body) end -- completes this tick
        self.ip = self.ip + 1
    elseif n.type == "if_else" then
        if self:evalCond(n.cond) then self:execBody(n.body)
        else self:execBody(n.elseBody) end
        self.ip = self.ip + 1
    elseif n.type == "repeat_until" then
        if self:evalCond(n.cond) then self.ip = self.ip + 1   -- done
        else self:execBody(n.body); self.yielded = true end   -- one iter/tick
    elseif n.type == "break" then
        self.ip = self.ip + 1                                -- caller handles exit
    elseif n.type == "set_var" then
        self.vars[n.name] = n.value; self.ip = self.ip + 1
    elseif n.type == "math_var" then
        local v = self.vars[n.name] or 0
        self.vars[n.name] = n.op == "add" and v + n.operand
            or n.op == "sub" and v - n.operand
            or n.op == "mul" and v * n.operand
            or (n.operand ~= 0 and v / n.operand or 0)
        self.ip = self.ip + 1
    -- … read_sensor, random_var, print, comment, macro (pre-expanded at load)
    end
end
```

### 2.3 Condition evaluation
```lua
function TileVM:evalCond(c)
    local v
    if c.sensor:sub(1, 4) == "var:" then
        v = self.vars[c.sensor:sub(5)] or 0
    elseif c.varValue then                    -- varVsCond
        v = self.vars[c.sensor] or 0
        local rhs = self.vars[c.varValue] or 0
        return compare(v, c.cmp, rhs)
    else
        v = self.adapter:read(c.sensor)       -- live sensor read
    end
    local notFlag = c.not == true
    local r = compare(v, c.cmp, c.value)
    return notFlag and not r or r
end
```

### 2.4 Loop bookkeeping (the subtle part)
JS uses an explicit IP + jump table; Luau's easiest faithful port is a
**frame-stack of body iterators** rather than an IP: each `forever`/
`repeat_until` pushes a closure that resumes next tick; `break` pops to the
loop boundary. Equivalent semantics, no jump resolution. (If bytecode parity
is wanted, port `TileCompiler.compile()` — `TileCompiler.js:55` — to emit
`{op, ...}` opcodes and keep the JS `switch` exactly; see §5.)

---

## 3. STRATEGY B — COMPILE TILES → LUAU SOURCE

Best for: performance with many bots, simpler debugging (readable generated
code), and mirrors `FirmwareGen`'s approach (JS already compiles tiles → C++/
Python; adding a Luau target is architecturally consistent).

### 3.1 Codegen table
| Tile | Luau output |
|------|-------------|
| `action drive {speed}` | `adapter:drive(speed)` |
| `action turn {degrees}` | `adapter:turn(degrees)` |
| `wait 0.5` | `yieldWait(0.5)` — see coroutine runtime below |
| `forever [body]` | `while true do body; yieldForever() end` |
| `repeat 4 [body]` | `for _ = 1,4 do body end` |
| `repeat_until (cond)` | `while not (cond) do body; yieldTick() end` |
| `wait_until (cond)` | `while not (cond) do yieldTick() end` |
| `if (cond) [t] else [f]` | `if cond then t else f end` |
| `break` | `break` |
| `set_var x 3` | `vars.x = 3` |
| `math_var x add 1` | `vars.x = (vars.x or 0) + 1` |
| `cond brightness lt 0.5` | `adapter:read("brightness") < 0.5` |
| `read_sensor d distance_ahead` | `vars.d = adapter:read("distance_ahead")` |
| `print score` | `print("score =", vars.score)` |

### 3.2 Runtime support (coroutines driven by Heartbeat)
```lua
-- MakerRuntime.lua — one coroutine per brained bot
local function botMain(program, adapter)
    local code = generateLuau(program)   -- compiled at load
    local chunk = loadstring("return function(vars, adapter, yieldWait, yieldForever, yieldTick) " .. code .. " end")
    local fn = chunk()
    local co = coroutine.create(function() fn({}, adapter, yieldWait, yieldForever, yieldTick) end)

    RunService.Heartbeat:Connect(function(dt)
        if coroutine.status(co) ~= "suspended" then return end
        local ok, err = coroutine.resume(co, dt)
        if not ok then warn("bot program error:", err) end
    end)
end
```
- `yieldWait(s)`: loop `coroutine.yield()` until accumulated time ≥ s (actuators
  stay latched between yields — same as JS).
- `yieldForever()`: `coroutine.yield()` once (one loop pass per frame).
- `yieldTick()`: `coroutine.yield()` once.
- Instruction budget: wrap the codegen with a counter (`steps = steps + 1`
  per statement; halt when exceeding budget — mirrors `budget--`).

---

## 4. SENSOR & ACTUATOR ADAPTER (Luau ↔ Roblox world)

### 4.1 Sensor map (19) — `primitives.js:35-436`
| Sensor | Kind | JS read | Roblox implementation |
|--------|------|---------|------------------------|
| brightness | analog | world light | `game.Lighting.Brightness`-derived value or a `LightProbe`/raycast from bot position |
| distance_ahead | analog | raycast forward, normalized ÷ SONAR_RANGE (6.0) | `Workspace:Raycast` from bot, `dist/6` clamped 0..1 |
| bumped | digital | `distanceAhead < 0.08` | `Touched` event on bumper part (or raycast threshold) |
| is_dark | digital | `dayNight.isNight`-ish | `Lighting.ClockTime` / Ambient value |
| player_near | digital | player within radius | `Magnitude` check to nearest player |
| sees_color / color_sensor | digital | floor block color | `GetPartColor3` on floor part under bot |
| target_bearing / target_distance | analog | waypoint/target geometry | `CFrame` math to target part |
| line_under | digital | dark line under bot | `GetPartColor3` luminance check on track part |
| compass | analog | heading 0..1 | bot `CFrame` Y rotation |
| temperature | analog | weather/zone | zone metadata (or `Workspace:GetAttribute`) |
| weather | digital | weather state | weather system state broadcast |
| waypoint_dist / waypoint_bearing | analog | waypoint part | `Magnitude` + angle to waypoint part |
| ore_nearby | analog | grid scan 10 (16 w/ signal_amp) blocks | spatial `Region3` scan for CrystalOre parts |
| floor_type | analog | block id under bot | `GetPartFromPoint` → part tag |
| battery | analog | bot charge 0..1 | bot state value |
| beacon_signal | analog | beacon strength | proximity to SignalBeacon parts |
| sees_target | digital | target in cone | `Raycast` + FOV check |

**Normalization rule:** analog sensors are **0..1 normalized** — Roblox raw
values (Raycast distance, Magnitude, luminance) must be divided by their
max range exactly like JS (`GameWorldAdapter.js:136` etc.).

### 4.2 Actuator map (11) — `primitives.js:439-650`
| Action | Roblox implementation |
|--------|------------------------|
| drive | apply force/velocity to bot `Model` (JS: DRIVE_SPEED 3.0 blocks/s × speed) |
| turn | rotate bot CFrame (JS: TURN_RATE 180°/s × value) |
| stop | zero velocity |
| beep | play beep Sound (baked asset, see asset bible) |
| led | toggle bot eye `PointLight`/emissive (cyan 0x00FFFF) |
| grab | magnet grab — attach nearby item parts to bot |
| speak | play speech Sound / chat bubble |
| servo_angle | rotate arm part |
| add_score | increment bot's score (race/obstacle mode) |
| neopixel | set ring of `PointLight`s / color sequence |
| vision | camera raycast → color/object detection (Jetson tier) |

### 4.3 Brain tier gating
`tin` → base sensor set (brightness, distance, bump, line, battery);
`spark` → adds motion/PIR/grab/neopixel; `vision` → adds vision/camera.
Port must enforce `SENSORS[s].hw.platform` / `ACTIONS[a].platform` gates —
the compiler rejects off-tier ops (`primitives.js` header contract).

---

## 5. BYTECODE PORT (if full VM parity is wanted)

`TileCompiler.compile()` (`TileCompiler.js:55-246`) emits flat opcodes
(`CONST, SENSE, CMP, NOT, JZ, JMP, ACT, WAIT, LOOP…` — `TileVM.js:112-160`).
Luau port = a direct transliteration (opcodes are already stackless/linear).
The JS VM's `LOOP` handles forever's one-pass-per-tick via `_yield`; keep a
`yielded` flag in the Luau step loop (`TileVM.js:77-101`). Macros must be
expanded **at compile time** (`expandMacro`, `TileCompiler.js:246`) — never
interpreted at runtime.

---

## 6. SAVE & SHARE FORMAT (unchanged in port)

- TileProgram JSON (schema v1) is the **canonical save format** — Roblox
  stores it in the profile DataStore (`tileEditor` field, see shared-yard doc).
- Share links: base64 `?brain=...` (`toShareCode`/`fromShareCode`) → port as
  `HttpService:JSONEncode` + `Base64` (`HttpService` has `Base64Encode`).
- Example seed programs to ship (from `TileProgram.js:162-352`): Wall Avoider,
  Light Runner, Line Follower, Square, Ore Hunter, Battery Saver, Waypoint Nav,
  Bump Counter — port these as starter templates.
- XP hooks to preserve: first sensor type used → +8 XP; first variable name →
  +10 XP (`XPSystem.js:66-84`); program run → `program_run` bond event (+4).

---

## 7. CHECKLIST FOR THE PORT

- [ ] Preserve one-pass-per-tick `forever` semantics (Strategy A: explicit; B: `yieldForever`)
- [ ] `repeat N` completes within one tick; `repeat_until` yields per iteration
- [ ] Wait keeps actuator latched state
- [ ] Instruction budget on every program (anti-hang)
- [ ] Analog sensors normalized 0..1 with same ranges (SONAR_RANGE=6, ore=10/16)
- [ ] Brain-tier gates enforced at compile time
- [ ] `break` exits enclosing loop (not the whole program)
- [ ] JSON schema v1 save + base64 share compat
- [ ] 8 example programs shipped as templates
- [ ] XP/bond hooks wired to run events

---

*Extracted 2026-08-23. Semantics verified against `maker/TileVM.js`,
`maker/TileCompiler.js`, `maker/TileProgram.js`, `maker/primitives.js`,
`maker/kinematics.js`.*
