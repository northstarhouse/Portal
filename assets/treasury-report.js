(() => {

const root = document.getElementById("nsh-fin");
if (root.dataset.ready) return;
root.dataset.ready = "1";

const CFG = window.__nshTreasuryConfig || {};
const SB_URL = CFG.url || "";
const SB_KEY = CFG.key || "";

function sbHeaders(extra){
  const h = { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY };
  return extra ? Object.assign(h, extra) : h;
}

function fetchReports(){
  return fetch(
    SB_URL + "/rest/v1/treasury_reports?select=report_type,period_key,tab_label,full_label,as_of_date,data&order=as_of_date.asc,period_key.asc",
    { headers: sbHeaders() }
  ).then(r => r.json());
}

function upsertReport(row){
  return fetch(
    SB_URL + "/rest/v1/treasury_reports?on_conflict=report_type,period_key",
    {
      method: "POST",
      headers: sbHeaders({ "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=representation" }),
      body: JSON.stringify([row])
    }
  ).then(r => r.json());
}

const state = {
  pl: {}, plOrder: [],
  bs: {}, bsOrder: [],
  budget: null
};

let activePeriod = null;
let activeReport = "pl";

const $ = id => root.querySelector("#" + id);

const money = n =>
  new Intl.NumberFormat("en-US", {
    style:"currency",
    currency:"USD",
    maximumFractionDigits:0
  }).format(Math.abs(n));

const signed = n =>
  (n < 0 ? "−" : "") + money(n);

const num = id => {
  const element = $(id);

  if (!element) return 0;

  const v = parseFloat(
    element.value.replace(/[$,\s]/g,"")
  );

  return Number.isFinite(v) ? v : 0;
};

function pct(a,b){
  return b === 0
    ? (a === 0 ? 0 : 100)
    : ((a-b) / Math.abs(b)) * 100;
}

const cleanLine = s =>
  s.toLowerCase()
  .replace(/["]/g,"")
  .replace(/\s+/g," ")
  .trim();

// Spreadsheet exports often wrap a category label in a quoted, multi-line
// cell (e.g. a `"Bricks` line followed by a line holding just its numbers).
// Pasted as plain text that splits the label from its numbers onto separate
// lines, so a label-only line gets folded into the next line that has digits
// before alias matching runs.
function mergeWrappedLines(text){
  const rawLines = text.split(/\r?\n/);
  const merged = [];
  let buffer = "";

  rawLines.forEach(line => {
    const hasNum = /\d/.test(line);
    if(buffer){
      buffer += " " + line.trim();
      if(hasNum){
        merged.push(buffer);
        buffer = "";
      }
    } else if(hasNum){
      merged.push(line);
    } else if(line.trim()){
      buffer = line.trim();
    }
  });

  if(buffer) merged.push(buffer);

  return merged;
}

function panelIdFor(report){
  return report === "pl" ? "plAdmin" : report === "bs" ? "bsAdmin" : "budgetAdmin";
}

function moneyIds(panelId){
  return Array.from(root.querySelectorAll("#" + panelId + " .money")).map(el => el.id);
}

function clearInputs(panelId){
  moneyIds(panelId).forEach(id => { if ($(id)) $(id).value = "0.00"; });
}

function applyRecord(panelId, rec){
  const data = (rec && rec.data) || {};
  moneyIds(panelId).forEach(id => {
    $(id).value = (parseFloat(data[id]) || 0).toFixed(2);
  });
}

/* =========================
   LOAD FROM SUPABASE
========================= */

function loadFromSupabase(){
  return fetchReports().then(rows => {
    state.pl = {}; state.plOrder = [];
    state.bs = {}; state.bsOrder = [];
    state.budget = null;

    (Array.isArray(rows) ? rows : []).forEach(r => {
      if (r.report_type === "pl") {
        state.pl[r.period_key] = r;
        state.plOrder.push(r.period_key);
      } else if (r.report_type === "bs") {
        state.bs[r.period_key] = r;
        state.bsOrder.push(r.period_key);
      } else if (r.report_type === "budget") {
        state.budget = r;
      }
    });
  }).catch(() => {});
}

function renderTabs(){

  const tabsEl = $("periodTabs");
  tabsEl.innerHTML = "";

  if (activeReport === "budget") {
    tabsEl.style.display = "none";
    return;
  }

  const order = activeReport === "pl" ? state.plOrder : state.bsOrder;
  const store = activeReport === "pl" ? state.pl : state.bs;

  if (!order.length) {
    tabsEl.style.display = "none";
    return;
  }

  tabsEl.style.display = "flex";

  order.forEach(key => {
    const rec = store[key];
    const btn = document.createElement("button");
    btn.className = "tab" + (key === activePeriod ? " active" : "");
    btn.type = "button";
    btn.dataset.period = key;
    btn.textContent = rec.tab_label || key;
    btn.addEventListener("click", () => loadPeriod(key));
    tabsEl.appendChild(btn);
  });
}

function loadPeriod(key){

  if (activeReport === "budget") {

    activePeriod = "current";
    const panelId = "budgetAdmin";

    if (state.budget) {
      applyRecord(panelId, state.budget);
      $("periodLabel").textContent = state.budget.full_label || "Budget vs Actual";
      $("emptyState").style.display = "none";
    } else {
      clearInputs(panelId);
      $("periodLabel").textContent = "Budget vs Actual — no report saved yet";
      $("emptyState").style.display = "block";
    }

  } else {

    const order = activeReport === "pl" ? state.plOrder : state.bsOrder;
    const store = activeReport === "pl" ? state.pl : state.bs;
    const panelId = activeReport === "pl" ? "plAdmin" : "bsAdmin";

    const resolvedKey = key && store[key] ? key : order[order.length - 1];
    activePeriod = resolvedKey || null;

    const rec = resolvedKey ? store[resolvedKey] : null;

    if (rec) {
      applyRecord(panelId, rec);
      $("periodLabel").textContent = rec.full_label || rec.tab_label || "";
      $("emptyState").style.display = "none";
    } else {
      clearInputs(panelId);
      $("periodLabel").textContent =
        activeReport === "pl"
        ? "Income & Expenses — no report saved yet"
        : "Balance Sheet — no report saved yet";
      $("emptyState").style.display = "block";
    }
  }

  renderTabs();

  $("adminBtn").classList.remove("active");
  $("input").classList.remove("active");
  $("dashboard").classList.add("active");

  showReport();

  if(activeReport === "pl"){
    render();
  }
  else if(activeReport === "bs"){
    renderBalance();
  }
  else{
    renderBudget();
  }
}

function showReport(){

  root.querySelectorAll(".reportview")
    .forEach(view => view.classList.remove("active"));

  const target =
    activeReport === "pl"
      ? "plDashboard"
      : activeReport === "bs"
      ? "bsDashboard"
      : "budgetDashboard";

  $(target).classList.add("active");

  root.querySelectorAll(".reporttab")
    .forEach(button => {
      button.classList.toggle(
        "active",
        button.dataset.report === activeReport
      );
    });
}

function barHTML(items,cls){

  const max = Math.max(
    ...items.map(x => Math.abs(x.v)),
    1
  );

  return items.map(x => {

    const width =
      Math.max(2, Math.abs(x.v) / max * 100);

    return `
      <div class="barrow">
        <div class="barlabel">${x.n}</div>

        <div class="bartrack">
          <div
            class="barfill ${cls}"
            style="width:${width}%">
          </div>
        </div>

        <div class="amount">${money(x.v)}</div>
      </div>
    `;

  }).join("");
}

/* =========================
   PROFIT & LOSS
========================= */

function render(){

  const inc = num("in_total26");
  const inc25 = num("in_total25");

  const exp = num("ex_total26");
  const exp25 = num("ex_total25");

  const net = inc - exp;
  const net25 = inc25 - exp25;

  const ip = pct(inc,inc25);
  const ep = pct(exp,exp25);

  $("incomeVal").textContent = money(inc);
  $("expenseVal").textContent = money(exp);
  $("netVal").textContent = signed(net);

  $("incomeDelta").textContent =
    (ip >= 0 ? "↑ " : "↓ ") +
    Math.abs(ip).toFixed(1) +
    "% vs. last year";

  $("incomeDelta").className =
    "delta " + (ip >= 0 ? "up" : "down");

  $("expenseDelta").textContent =
    (ep >= 0 ? "↑ " : "↓ ") +
    Math.abs(ep).toFixed(1) +
    "% vs. last year";

  $("expenseDelta").className =
    "delta " + (ep > ip ? "down" : "up");

  const nd = net - net25;

  $("netDelta").textContent =
    money(nd) +
    " " +
    (nd >= 0 ? "better" : "worse") +
    " than 2025";

  $("netDelta").className =
    "delta " + (nd >= 0 ? "up" : "down");

  const incDiff = inc - inc25;
  const expDiff = exp - exp25;

  $("story").innerHTML = `
    <strong>The simple read:</strong>
    Income ${incDiff >= 0 ? "increased" : "decreased"}
    about ${money(incDiff)}, while expenses
    ${expDiff >= 0 ? "increased" : "decreased"}
    about ${money(expDiff)}.
    That leaves a
    ${net < 0 ? "deficit" : "surplus"}
    of <strong>${money(net)}</strong>.
  `;

  const incomes = [
    ["Events & Weddings","events26"],
    ["Donations","don26"],
    ["Memberships / Sponsors","mem26"],
    ["Other Income","other26"],
    ["Bricks","bricks26"]
  ]
  .map(([n,id]) => ({
    n,
    v:num(id)
  }))
  .sort((a,b) => b.v-a.v);

  $("incomeBars").innerHTML =
    barHTML(incomes,"income");

  let major = [
    ["Payroll","pay26"],
    ["Capital / Restoration","cap26"],
    ["Depreciation","dep26"],
    ["Insurance","ins26"],
    ["Cleaning","clean26"],
    ["Utilities","util26"]
  ]
  .map(([n,id]) => ({
    n,
    v:num(id)
  }));

  const majorSum =
    major.reduce((sum,x) => sum+x.v,0);

  major.push({
    n:"All other expenses",
    v:Math.max(0,exp-majorSum)
  });

  major.sort((a,b) => b.v-a.v);

  $("expenseBars").innerHTML =
    barHTML(major,"");

  $("eventDriver").textContent =
    money(num("events26"));

  $("payrollDriver").textContent =
    money(num("pay26"));

  const gap = ep-ip;

  $("gapDriver").textContent =
    (gap >= 0 ? "+" : "") +
    gap.toFixed(0) +
    " pts";

  $("gapText").textContent =
    gap >= 0
    ? `Expenses grew about ${gap.toFixed(0)} percentage points faster than income.`
    : `Income growth exceeded expense growth by about ${Math.abs(gap).toFixed(0)} percentage points.`;

  adjust();
}

function adjust(){

  let n =
    num("in_total26") -
    num("ex_total26");

  const parts = [];

  if($("excludeDep").checked){
    n += num("dep26");
    parts.push("depreciation");
  }

  if($("excludeCap").checked){
    n += num("cap26");
    parts.push("capital/restoration");
  }

  $("adjResult").textContent =
    parts.length
    ? "Analytical result: " + signed(n)
    : "Official net: " + signed(n);
}

/* =========================
   BALANCE SHEET
========================= */

function renderBalance(){

  const assets = num("bs_assets26");
  const assets25 = num("bs_assets25");

  const cash = num("bs_cash26");
  const cash25 = num("bs_cash25");

  const liab = num("bs_liab26");
  const liab25 = num("bs_liab25");

  const ap = pct(assets,assets25);
  const cp = pct(cash,cash25);
  const lp = pct(liab,liab25);

  $("bsAssetsVal").textContent =
    money(assets);

  $("bsAssetsDelta").textContent =
    (ap >= 0 ? "↑ " : "↓ ") +
    Math.abs(ap).toFixed(1) +
    "% vs. last year";

  $("bsAssetsDelta").className =
    "delta " + (ap >= 0 ? "up" : "down");

  $("bsCashVal").textContent =
    money(cash);

  $("bsCashDelta").textContent =
    (cp >= 0 ? "↑ " : "↓ ") +
    Math.abs(cp).toFixed(1) +
    "% vs. last year";

  $("bsCashDelta").className =
    "delta " + (cp >= 0 ? "up" : "down");

  $("bsLiabVal").textContent =
    money(liab);

  $("bsLiabDelta").textContent =
    (lp >= 0 ? "↑ " : "↓ ") +
    Math.abs(lp).toFixed(1) +
    "% vs. last year";

  $("bsLiabDelta").className =
    "delta " + (lp <= 0 ? "up" : "down");

  const cashDiff =
    cash-cash25;

  const liabDiff =
    liab-liab25;

  $("bsStory").innerHTML = `
    <strong>The simple read:</strong>
    Total assets are
    ${ap >= 0 ? "up" : "down"}
    ${Math.abs(ap).toFixed(1)}%
    from last year.
    Cash is ${money(cashDiff)}
    ${cashDiff >= 0 ? "higher" : "lower"},
    while liabilities are
    ${money(liabDiff)}
    ${liabDiff >= 0 ? "higher" : "lower"}.
  `;

  const assetItems = [
    {
      n:"Fixed assets",
      v:num("bs_fixed26")
    },
    {
      n:"Cash",
      v:num("bs_cash26")
    },
    {
      n:"Other current assets",
      v:num("bs_othercur26")
    },
    {
      n:"Accounts receivable",
      v:Math.abs(num("bs_ar26"))
    }
  ]
  .sort((a,b) => b.v-a.v);

  $("bsAssetBars").innerHTML =
    barHTML(assetItems,"asset");

  const funding = [
    {
      n:"Equity",
      v:num("bs_equity26")
    },
    {
      n:"Liabilities",
      v:Math.abs(num("bs_liab26"))
    }
  ]
  .sort((a,b) => b.v-a.v);

  $("bsFundingBars").innerHTML =
    barHTML(funding,"");

  $("bsCurrentDriver").textContent =
    money(num("bs_current26"));

  $("bsFixedDriver").textContent =
    money(num("bs_fixed26"));

  $("bsCurrentLiabDriver").textContent =
    money(num("bs_currentliab26"));

  $("bsLiquidityText").textContent =
    cp >= 0
    ? `Cash is ${Math.abs(cp).toFixed(1)}% higher than the comparable 2025 balance.`
    : `Cash is ${Math.abs(cp).toFixed(1)}% lower than the comparable 2025 balance.`;

  $("bsWatchText").textContent =
    lp > 0
    ? `Total liabilities are ${Math.abs(lp).toFixed(1)}% higher than the comparable 2025 balance.`
    : `Total liabilities are ${Math.abs(lp).toFixed(1)}% lower than the comparable 2025 balance.`;
}

/* =========================
   BUDGET
========================= */

function budgetBarHTML(items){

  return items.map(x => {

    const ratio =
      x.b === 0
      ? 0
      : (x.a/x.b)*100;

    const width =
      Math.max(
        2,
        Math.min(100,Math.abs(ratio))
      );

    const cls =
      ratio > 100
      ? "down"
      : "income";

    return `
      <div class="barrow">

        <div class="barlabel">
          ${x.n}
        </div>

        <div class="bartrack">
          <div
            class="barfill ${cls}"
            style="width:${width}%">
          </div>
        </div>

        <div class="amount">
          ${money(x.a)} / ${money(x.b)}
        </div>

      </div>
    `;

  }).join("");
}

function renderBudget(){

  const inc =
    num("bud_income_actual");

  const incBud =
    num("bud_income_budget");

  const exp =
    num("bud_expense_actual");

  const expBud =
    num("bud_expense_budget");

  const net =
    num("bud_net_actual");

  const netBud =
    num("bud_net_budget");

  const incPct =
    incBud
    ? inc/incBud*100
    : 0;

  const expPct =
    expBud
    ? exp/expBud*100
    : 0;

  const netGap =
    net-netBud;

  $("budgetIncomeVal").textContent =
    money(inc);

  $("budgetIncomeDelta").textContent =
    incPct.toFixed(1) +
    "% of cash budget";

  $("budgetExpenseVal").textContent =
    money(exp);

  $("budgetExpenseDelta").textContent =
    expPct.toFixed(1) +
    "% of cash budget";

  $("budgetNetVal").textContent =
    signed(net);

  $("budgetNetDelta").textContent =
    money(netGap) +
    " " +
    (netGap >= 0 ? "better" : "below") +
    " budgeted net";

  $("budgetNetDelta").className =
    "delta " +
    (netGap >= 0 ? "up" : "down");

  $("budgetIncomePct").textContent =
    incPct.toFixed(0) + "%";

  $("budgetExpensePct").textContent =
    expPct.toFixed(0) + "%";

  $("budgetNetGap").textContent =
    signed(netGap);

  $("budgetNetGapText").textContent =
    netGap >= 0
    ? "Actual net income is better than the budgeted net position."
    : "Actual net income is more negative than the budgeted net position.";

  const incomeItems = [
    {
      n:"Events",
      a:num("bud_events_actual"),
      b:num("bud_events_budget")
    },
    {
      n:"Donations",
      a:num("bud_don_actual"),
      b:num("bud_don_budget")
    },
    {
      n:"Memberships",
      a:num("bud_mem_actual"),
      b:num("bud_mem_budget")
    },
    {
      n:"Other income",
      a:num("bud_other_actual"),
      b:num("bud_other_budget")
    },
    {
      n:"Bricks",
      a:num("bud_bricks_actual"),
      b:num("bud_bricks_budget")
    }
  ];

  $("budgetIncomeBars").innerHTML =
    budgetBarHTML(incomeItems);

  const expenseItems = [
    {
      n:"Payroll",
      a:num("bud_pay_actual"),
      b:num("bud_pay_budget")
    },
    {
      n:"Capital / Restoration",
      a:num("bud_cap_actual"),
      b:num("bud_cap_budget")
    },
    {
      n:"Insurance",
      a:num("bud_ins_actual"),
      b:num("bud_ins_budget")
    },
    {
      n:"Utilities",
      a:num("bud_util_actual"),
      b:num("bud_util_budget")
    },
    {
      n:"R&M Grounds",
      a:num("bud_ground_actual"),
      b:num("bud_ground_budget")
    },
    {
      n:"Cleaning",
      a:num("bud_clean_actual"),
      b:num("bud_clean_budget")
    },
    {
      n:"Events",
      a:num("bud_eventexp_actual"),
      b:num("bud_eventexp_budget")
    },
    {
      n:"R&M House",
      a:num("bud_house_actual"),
      b:num("bud_house_budget")
    },
    {
      n:"Volunteer",
      a:num("bud_vol_actual"),
      b:num("bud_vol_budget")
    }
  ];

  $("budgetExpenseBars").innerHTML =
    budgetBarHTML(expenseItems);

  const visibleIncome =
    num("bud_don_actual") +
    num("bud_bricks_actual") +
    num("bud_events_actual") +
    num("bud_mem_actual") +
    num("bud_other_actual");

  const sourceDiff =
    visibleIncome-inc;

  $("budgetStory").innerHTML = `
    <strong>The simple read:</strong>
    The source report shows ${money(inc)}
    in Actual Total Income against a
    ${money(incBud)} Cash Budget,
    and ${money(exp)}
    in Actual Total Expense against
    a ${money(expBud)} Cash Budget.
    Actual net ordinary income is
    ${signed(net)} versus a budgeted
    ${signed(netBud)}.
  `;

  $("budgetSourceNote").textContent =
    Math.abs(sourceDiff) > 1
    ? `The source report lists Actual Total Income as ${money(inc)}, while the visible actual income category totals sum to ${money(visibleIncome)}. The dashboard preserves the stated source total and flags the ${money(sourceDiff)} difference rather than correcting it.`
    : "The source total income matches the visible income category sum.";

  const over =
    expenseItems
    .filter(x => x.b > 0 && x.a > x.b)
    .map(x => x.n);

  const underIncome =
    incomeItems
    .filter(x => x.b > 0 && x.a/x.b < .6)
    .map(x => x.n);

  $("budgetWatchText").textContent =
    `Over-budget expense lines: ${
      over.length
      ? over.join(", ")
      : "none among the tracked categories"
    }. Income categories below 60% of budget: ${
      underIncome.length
      ? underIncome.join(", ")
      : "none among the tracked categories"
    }.`;
}

/* =========================
   P&L PARSER
========================= */

function parsePasted(){

  const text =
    $("pasteData").value.trim();

  if(!text){
    $("inputStatus").textContent =
      "Paste P&L text first.";
    return;
  }

  const aliases = [

    {
      keys:["total income"],
      ids:["in_total26","in_total25"]
    },

    {
      keys:["total expense","total expenses"],
      ids:["ex_total26","ex_total25"]
    },

    {
      keys:["total event income"],
      ids:["events26","events25"]
    },

    {
      keys:["total donations"],
      ids:["don26","don25"]
    },

    {
      keys:[
        "total memberships and sponsorships",
        "total memberships & sponsorships"
      ],
      ids:["mem26","mem25"]
    },

    {
      keys:["total other income"],
      ids:["other26","other25"]
    },

    {
      keys:["bricks"],
      ids:["bricks26","bricks25"],
      exact:true
    },

    {
      keys:[
        "total payroll expenses",
        "payroll expenses"
      ],
      ids:["pay26","pay25"]
    },

    {
      keys:[
        "total capital improvements/restore",
        "total capital improvements",
        "capital improvements/restore"
      ],
      ids:["cap26","cap25"]
    },

    {
      keys:[
        "depreciation & amortization",
        "depreciation and amortization"
      ],
      ids:["dep26","dep25"]
    },

    {
      keys:["total insurance"],
      ids:["ins26","ins25"]
    },

    {
      keys:["cleaning service"],
      ids:["clean26","clean25"]
    },

    {
      keys:["total utilities"],
      ids:["util26","util25"]
    }

  ];

  let found = 0;

  for(const line of mergeWrappedLines(text)){

    const normalized =
      cleanLine(line);

    const nums =
      line.match(
        /-?\$?\s*\d[\d,]*(?:\.\d+)?/g
      );

    if(!nums || nums.length < 2){
      continue;
    }

    for(const a of aliases){

      const match =
        a.exact
        ? a.keys.some(k =>
            normalized.startsWith(k+" ") ||
            normalized === k
          )
        : a.keys.some(k =>
            normalized.includes(k)
          );

      if(!match){
        continue;
      }

      const vals =
        nums.slice(0,2).map(v =>
          parseFloat(
            v.replace(/[$,\s]/g,"")
          )
        );

      if(vals.every(Number.isFinite)){

        a.ids.forEach((id,i) => {
          $(id).value =
            vals[i].toFixed(2);
        });

        found++;
        break;
      }
    }
  }

  render();

  $("inputStatus").textContent =
    found
    ? `Parsed ${found} dashboard categories. Review the values below, then Save & Update.`
    : "No recognized P&L totals were found.";
}

/* =========================
   BALANCE SHEET PARSER
========================= */

function parseBalance(){

  const text =
    $("bsPasteData").value.trim();

  if(!text){

    $("bsInputStatus").textContent =
      "Paste Balance Sheet text first.";

    return;
  }

  const aliases = [

    {
      keys:["total cash","total checking/savings"],
      ids:["bs_cash26","bs_cash25"]
    },

    {
      keys:[
        "total accounts receivable",
        "accounts receivable"
      ],
      ids:["bs_ar26","bs_ar25"]
    },

    {
      keys:["total other current assets"],
      ids:["bs_othercur26","bs_othercur25"]
    },

    {
      keys:["total current assets"],
      ids:["bs_current26","bs_current25"]
    },

    {
      keys:["total fixed assets"],
      ids:["bs_fixed26","bs_fixed25"]
    },

    {
      keys:["total assets"],
      ids:["bs_assets26","bs_assets25"]
    },

    {
      keys:["total accounts payable"],
      ids:["bs_ap26","bs_ap25"]
    },

    {
      keys:["total credit cards"],
      ids:["bs_cc26","bs_cc25"]
    },

    {
      keys:["total other current liabilities"],
      ids:["bs_otherliab26","bs_otherliab25"]
    },

    {
      keys:["total current liabilities"],
      ids:["bs_currentliab26","bs_currentliab25"]
    },

    {
      keys:["total liabilities"],
      ids:["bs_liab26","bs_liab25"]
    },

    {
      keys:["total net assets"],
      ids:["bs_netassets26","bs_netassets25"]
    },

    {
      keys:[
        "unrestricted(retained earnings)",
        "retained earnings"
      ],
      ids:["bs_retained26","bs_retained25"]
    },

    {
      keys:["net income"],
      ids:["bs_netincome26","bs_netincome25"],
      exact:true
    },

    {
      keys:["total equity"],
      ids:["bs_equity26","bs_equity25"]
    }

  ];

  let found = 0;

  for(const line of mergeWrappedLines(text)){

    const normalized =
      cleanLine(line);

    const nums =
      line.match(
        /-?\$?\s*\d[\d,]*(?:\.\d+)?/g
      );

    if(!nums || nums.length < 2){
      continue;
    }

    for(const a of aliases){

      const match =
        a.exact
        ? a.keys.some(k =>
            normalized.startsWith(k+" ") ||
            normalized === k
          )
        : a.keys.some(k =>
            normalized.includes(k)
          );

      if(!match){
        continue;
      }

      const vals =
        nums.slice(0,2).map(v =>
          parseFloat(
            v.replace(/[$,\s]/g,"")
          )
        );

      if(vals.every(Number.isFinite)){

        a.ids.forEach((id,i) => {
          $(id).value =
            vals[i].toFixed(2);
        });

        found++;
        break;
      }
    }
  }

  renderBalance();

  $("bsInputStatus").textContent =
    found
    ? `Parsed ${found} balance sheet categories. Review the values below, then Save & Update.`
    : "No recognized Balance Sheet totals were found.";
}

/* =========================
   BUDGET PARSER
========================= */

function parseBudget(){

  const text =
    $("budgetPasteData").value.trim();

  if(!text){

    $("budgetInputStatus").textContent =
      "Paste Budget to Actual text first.";

    return;
  }

  const aliases = [

    {
      keys:["total income"],
      ids:[
        "bud_income_actual",
        "bud_income_budget"
      ]
    },

    {
      keys:["total expense"],
      ids:[
        "bud_expense_actual",
        "bud_expense_budget"
      ]
    },

    {
      keys:["net ordinary income"],
      ids:[
        "bud_net_actual",
        "bud_net_budget"
      ]
    },

    {
      keys:["total donations"],
      ids:[
        "bud_don_actual",
        "bud_don_budget"
      ]
    },

    {
      keys:["bricks"],
      ids:[
        "bud_bricks_actual",
        "bud_bricks_budget"
      ],
      exact:true
    },

    {
      keys:["total event income"],
      ids:[
        "bud_events_actual",
        "bud_events_budget"
      ]
    },

    {
      keys:[
        "memberships and sponsorships",
        "memberships & sponsorships"
      ],
      ids:[
        "bud_mem_actual",
        "bud_mem_budget"
      ]
    },

    {
      keys:["total other income"],
      ids:[
        "bud_other_actual",
        "bud_other_budget"
      ]
    },

    {
      keys:["total capital improvements/restore"],
      ids:[
        "bud_cap_actual",
        "bud_cap_budget"
      ]
    },

    {
      keys:["cleaning service"],
      ids:[
        "bud_clean_actual",
        "bud_clean_budget"
      ]
    },

    {
      keys:["total events expenses"],
      ids:[
        "bud_eventexp_actual",
        "bud_eventexp_budget"
      ]
    },

    {
      keys:["total insurance"],
      ids:[
        "bud_ins_actual",
        "bud_ins_budget"
      ]
    },

    {
      keys:["payroll expenses"],
      ids:[
        "bud_pay_actual",
        "bud_pay_budget"
      ]
    },

    {
      keys:["total r&m grounds"],
      ids:[
        "bud_ground_actual",
        "bud_ground_budget"
      ]
    },

    {
      keys:["total r&m house"],
      ids:[
        "bud_house_actual",
        "bud_house_budget"
      ]
    },

    {
      keys:["utilities"],
      ids:[
        "bud_util_actual",
        "bud_util_budget"
      ],
      exact:true
    },

    {
      keys:["volunteer expenses"],
      ids:[
        "bud_vol_actual",
        "bud_vol_budget"
      ]
    }

  ];

  let found = 0;

  for(const line of mergeWrappedLines(text)){

    const normalized =
      cleanLine(line);

    const nums =
      line.match(
        /-?\$?\s*\(?\s*\d[\d,]*(?:\.\d+)?\s*\)?/g
      );

    if(!nums || nums.length < 2){
      continue;
    }

    for(const a of aliases){

      const match =
        a.exact
        ? a.keys.some(k =>
            normalized.startsWith(k+" ") ||
            normalized === k
          )
        : a.keys.some(k =>
            normalized.includes(k)
          );

      if(!match){
        continue;
      }

      const vals =
        nums.slice(0,2).map(v => {

          const neg =
            /\(/.test(v) ||
            /^\s*-/.test(v);

          const cleaned =
            v
            .replace(/,/g,"")
            .replace(/[()$\s]/g,"");

          const n =
            parseFloat(cleaned);

          return neg
            ? -Math.abs(n)
            : n;
        });

      if(vals.every(Number.isFinite)){

        a.ids.forEach((id,i) => {
          $(id).value =
            vals[i].toFixed(2);
        });

        found++;
        break;
      }
    }
  }

  renderBudget();

  $("budgetInputStatus").textContent =
    found
    ? `Parsed ${found} budget categories. Review the values below, then Save & Update.`
    : "No recognized Budget to Actual totals were found.";
}

/* =========================
   REPORT TABS
========================= */

root.querySelectorAll(".reporttab")
.forEach(button => {

  button.addEventListener(
    "click",
    () => {

      activeReport =
        button.dataset.report;

      loadPeriod(activePeriod);

    }
  );

});

/* =========================
   ADMIN
========================= */

function prefillMeta(){

  if (activeReport === "pl") {
    const rec = activePeriod ? state.pl[activePeriod] : null;
    $("pl_period_key").value = rec ? activePeriod : "";
    $("pl_tab_label").value = rec ? (rec.tab_label || "") : "";
    $("pl_full_label").value = rec ? (rec.full_label || "") : "";
    $("pl_as_of_date").value = rec && rec.as_of_date ? rec.as_of_date : "";
  } else if (activeReport === "bs") {
    const rec = activePeriod ? state.bs[activePeriod] : null;
    $("bs_period_key").value = rec ? activePeriod : "";
    $("bs_tab_label").value = rec ? (rec.tab_label || "") : "";
    $("bs_full_label").value = rec ? (rec.full_label || "") : "";
    $("bs_as_of_date").value = rec && rec.as_of_date ? rec.as_of_date : "";
  } else {
    $("budget_full_label").value = state.budget ? (state.budget.full_label || "") : "";
  }
}

$("adminBtn")
.addEventListener("click",() => {

  root.querySelectorAll(".view")
    .forEach(x =>
      x.classList.remove("active")
    );

  $("adminBtn")
    .classList.add("active");

  $("input")
    .classList.add("active");

  root.querySelectorAll(".adminpanel")
    .forEach(x =>
      x.classList.remove("active")
    );

  const target = panelIdFor(activeReport);

  $(target)
    .classList.add("active");

  prefillMeta();

  $("periodLabel").textContent =
    activeReport === "pl"
    ? "Admin · Income & Expense parser"
    : activeReport === "bs"
    ? "Admin · Balance Sheet parser"
    : "Admin · Budget vs Actual parser";

});

/* =========================
   P&L BUTTONS
========================= */

$("parseBtn")
.addEventListener(
  "click",
  parsePasted
);

$("clearPasteBtn")
.addEventListener("click",() => {

  $("pasteData").value = "";

  $("inputStatus").textContent =
    "Paste area cleared.";

});

$("updateBtn")
.addEventListener("click",() => {

  const periodKey = $("pl_period_key").value.trim();

  if(!periodKey){
    $("inputStatus").textContent =
      "Enter a period key before saving (e.g. aug26).";
    return;
  }

  const row = {
    report_type: "pl",
    period_key: periodKey,
    tab_label: $("pl_tab_label").value.trim() || periodKey,
    full_label: $("pl_full_label").value.trim() || null,
    as_of_date: $("pl_as_of_date").value || null,
    data: Object.fromEntries(
      moneyIds("plAdmin").map(id => [id, num(id)])
    )
  };

  $("inputStatus").textContent = "Saving…";

  upsertReport(row).then(() => loadFromSupabase()).then(() => {

    activeReport = "pl";
    activePeriod = periodKey;

    $("inputStatus").textContent =
      "P&L dashboard saved and updated.";

    $("adminBtn").classList.remove("active");
    $("input").classList.remove("active");
    $("dashboard").classList.add("active");

    loadPeriod(periodKey);

  }).catch(() => {
    $("inputStatus").textContent =
      "Could not save — check your connection and try again.";
  });

});

$("resetBtn")
.addEventListener("click",() => {

  loadFromSupabase().then(() => {
    loadPeriod(activePeriod);
    $("inputStatus").textContent =
      "Saved values restored.";
  });

});

/* =========================
   BALANCE BUTTONS
========================= */

$("bsParseBtn")
.addEventListener(
  "click",
  parseBalance
);

$("bsClearPasteBtn")
.addEventListener("click",() => {

  $("bsPasteData").value = "";

  $("bsInputStatus").textContent =
    "Paste area cleared.";

});

$("bsUpdateBtn")
.addEventListener("click",() => {

  const periodKey = $("bs_period_key").value.trim();

  if(!periodKey){
    $("bsInputStatus").textContent =
      "Enter a period key before saving (e.g. aug26).";
    return;
  }

  const row = {
    report_type: "bs",
    period_key: periodKey,
    tab_label: $("bs_tab_label").value.trim() || periodKey,
    full_label: $("bs_full_label").value.trim() || null,
    as_of_date: $("bs_as_of_date").value || null,
    data: Object.fromEntries(
      moneyIds("bsAdmin").map(id => [id, num(id)])
    )
  };

  $("bsInputStatus").textContent = "Saving…";

  upsertReport(row).then(() => loadFromSupabase()).then(() => {

    activeReport = "bs";
    activePeriod = periodKey;

    $("bsInputStatus").textContent =
      "Balance Sheet dashboard saved and updated.";

    $("adminBtn").classList.remove("active");
    $("input").classList.remove("active");
    $("dashboard").classList.add("active");

    loadPeriod(periodKey);

  }).catch(() => {
    $("bsInputStatus").textContent =
      "Could not save — check your connection and try again.";
  });

});

$("bsResetBtn")
.addEventListener("click",() => {

  loadFromSupabase().then(() => {
    loadPeriod(activePeriod);
    $("bsInputStatus").textContent =
      "Saved values restored.";
  });

});

/* =========================
   BUDGET BUTTONS
========================= */

$("budgetParseBtn")
.addEventListener(
  "click",
  parseBudget
);

$("budgetClearPasteBtn")
.addEventListener("click",() => {

  $("budgetPasteData").value = "";

  $("budgetInputStatus").textContent =
    "Paste area cleared.";

});

$("budgetUpdateBtn")
.addEventListener("click",() => {

  const row = {
    report_type: "budget",
    period_key: "current",
    tab_label: null,
    full_label: $("budget_full_label").value.trim() || null,
    as_of_date: null,
    data: Object.fromEntries(
      moneyIds("budgetAdmin").map(id => [id, num(id)])
    )
  };

  $("budgetInputStatus").textContent = "Saving…";

  upsertReport(row).then(() => loadFromSupabase()).then(() => {

    activeReport = "budget";

    $("budgetInputStatus").textContent =
      "Budget dashboard saved and updated.";

    $("adminBtn").classList.remove("active");
    $("input").classList.remove("active");
    $("dashboard").classList.add("active");

    loadPeriod(null);

  }).catch(() => {
    $("budgetInputStatus").textContent =
      "Could not save — check your connection and try again.";
  });

});

$("budgetResetBtn")
.addEventListener("click",() => {

  loadFromSupabase().then(() => {
    loadPeriod(null);
    $("budgetInputStatus").textContent =
      "Saved values restored.";
  });

});

/* =========================
   ANALYTICAL TOGGLES
========================= */

$("excludeDep")
.addEventListener(
  "change",
  adjust
);

$("excludeCap")
.addEventListener(
  "change",
  adjust
);

/* INITIAL LOAD */
loadFromSupabase().then(() => loadPeriod(null));

})();
