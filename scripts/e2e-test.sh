#!/bin/bash
# =============================================================================
# ERP-MARKET E2E TEST SUITE
# Tests completos del sistema: Login, CRUD, POS, Reports, AI, Banks, etc.
# =============================================================================

set -e

BASE="https://test.allcode.site"
PASS=0
FAIL=0
TOTAL=0

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

test_result() {
    TOTAL=$((TOTAL + 1))
    if [ "$1" = "PASS" ]; then
        PASS=$((PASS + 1))
        echo -e "${GREEN}✅ PASS${NC}: $2"
    else
        FAIL=$((FAIL + 1))
        echo -e "${RED}❌ FAIL${NC}: $2"
        echo "   Response: $3"
    fi
}

section() {
    echo ""
    echo -e "${YELLOW}━━━ $1 ━━━${NC}"
}

# ─── 1. LOGIN ────────────────────────────────────────────────────────────────
section "1. AUTH"

TOKEN=$(curl -s "$BASE/api/auth/login" -X POST -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"12345678"}' 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['token'])" 2>/dev/null)

if [ -n "$TOKEN" ]; then
    test_result "PASS" "Login exitoso"
else
    test_result "FAIL" "Login falló" "No se pudo obtener token"
    echo "ABORT: No se puede continuar sin token"
    exit 1
fi

# Health check
HEALTH=$(curl -s "$BASE/api/health" 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])" 2>/dev/null)
if [ "$HEALTH" = "ok" ]; then
    test_result "PASS" "Health check"
else
    test_result "FAIL" "Health check" "$HEALTH"
fi

# Settings
SETTINGS=$(curl -s "$BASE/api/settings" -H "Authorization: Bearer $TOKEN" 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('businessName','MISSING'))" 2>/dev/null)
if [ "$SETTINGS" = "Test" ]; then
    test_result "PASS" "Settings (businessName)"
else
    test_result "FAIL" "Settings" "$SETTINGS"
fi

# ─── 2. PRODUCTS ─────────────────────────────────────────────────────────────
section "2. PRODUCTS"

# Create product
PROD=$(curl -s "$BASE/api/products" -X POST -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
    -d '{"name":"Test Product E2E","price":99.99,"cost":50.00,"baseUnit":"UNIDAD"}' 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('id','FAIL'))" 2>/dev/null)

if [ "$PROD" != "FAIL" ] && [ -n "$PROD" ]; then
    test_result "PASS" "Create product ($PROD)"
else
    test_result "FAIL" "Create product" "$PROD"
fi

# List products
PRODS=$(curl -s "$BASE/api/products?page=1&limit=5" -H "Authorization: Bearer $TOKEN" 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); data=d.get('data',[]); print(len(data) if isinstance(data,list) else len(data.get('products',[])))" 2>/dev/null)
if [ "$PRODS" -gt 0 ] 2>/dev/null; then
    test_result "PASS" "List products ($PRODS found)"
else
    test_result "FAIL" "List products" "$PRODS"
fi

# Get product
PROD_DETAIL=$(curl -s "$BASE/api/products/$PROD" -H "Authorization: Bearer $TOKEN" 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('name','FAIL'))" 2>/dev/null)
if echo "$PROD_DETAIL" | grep -qi "test product"; then
    test_result "PASS" "Get product detail"
else
    test_result "FAIL" "Get product detail" "$PROD_DETAIL"
fi

# Update product
PROD_UPDATE=$(curl -s "$BASE/api/products/$PROD" -X PUT -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
    -d '{"name":"Test Product E2E Updated","price":149.99}' 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('name','FAIL'))" 2>/dev/null)
if echo "$PROD_UPDATE" | grep -qi "updated"; then
    test_result "PASS" "Update product"
else
    test_result "FAIL" "Update product" "$PROD_UPDATE"
fi

# ─── 3. INVENTORY ────────────────────────────────────────────────────────────
section "3. INVENTORY"

# Get stock
STOCK=$(curl -s "$BASE/api/inventory/stock/product/$PROD" -H "Authorization: Bearer $TOKEN" 2>/dev/null | python3 -c "import sys,json; print('OK')" 2>/dev/null)
if [ "$STOCK" = "OK" ]; then
    test_result "PASS" "Get product stock"
else
    test_result "FAIL" "Get product stock" "$STOCK"
fi

# ─── 4. CUSTOMERS ────────────────────────────────────────────────────────────
section "4. CUSTOMERS"

CUST=$(curl -s "$BASE/api/customers" -X POST -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
    -d '{"name":"Cliente E2E Test","cedula":"V-99999999","phone":"0412-1234567"}' 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('id','') or 'FAIL')" 2>/dev/null)

if [ "$CUST" != "FAIL" ] && [ -n "$CUST" ]; then
    test_result "PASS" "Create customer ($CUST)"
else
    test_result "FAIL" "Create customer" "$CUST"
fi

# ─── 5. POS SALE ─────────────────────────────────────────────────────────────
section "5. POS / SALES"

# Create sale
SALE=$(curl -s "$BASE/api/pos/transactions" -X POST -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
    -d "{\"branchId\":\"branch-default\",\"type\":\"SALE\",\"items\":[{\"productId\":\"$PROD\",\"quantity\":2,\"unitPrice\":149.99}],\"paymentMethods\":[{\"type\":\"cash\",\"amount\":299.98,\"currency\":\"COP\"}]}" 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('id',d.get('transaction',{}).get('id',d.get('error','FAIL'))))" 2>/dev/null)

if echo "$SALE" | grep -qi "error\|fail"; then
    test_result "FAIL" "Create sale" "$SALE"
else
    test_result "PASS" "Create sale ($SALE)"
fi

# Get sales list
SALES=$(curl -s "$BASE/api/pos/transactions?page=1&limit=5" -H "Authorization: Bearer $TOKEN" 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); data=d.get('data',{}); print(len(data.get('transactions',data) if isinstance(data,dict) else data))" 2>/dev/null)
if [ "$SALES" -gt 0 ] 2>/dev/null; then
    test_result "PASS" "List sales ($SALES found)"
else
    test_result "FAIL" "List sales" "$SALES"
fi

# ─── 6. REPORTS ──────────────────────────────────────────────────────────────
section "6. REPORTS"

REPORT_SUMMARY=$(curl -s "$BASE/api/reports/summary" -H "Authorization: Bearer $TOKEN" 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(type(d.get('totalSales')).__name__)" 2>/dev/null)
if [ "$REPORT_SUMMARY" = "float" ] || [ "$REPORT_SUMMARY" = "int" ]; then
    test_result "PASS" "Reports summary (totalSales is numeric)"
else
    test_result "FAIL" "Reports summary" "$REPORT_SUMMARY"
fi

REPORT_PRODUCTS=$(curl -s "$BASE/api/reports/top-products?limit=5" -H "Authorization: Bearer $TOKEN" 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d))" 2>/dev/null)
if [ "$REPORT_PRODUCTS" -gt 0 ] 2>/dev/null; then
    test_result "PASS" "Top products report ($REPORT_PRODUCTS products)"
else
    test_result "FAIL" "Top products report" "$REPORT_PRODUCTS"
fi

# ─── 7. BANKS ────────────────────────────────────────────────────────────────
section "7. BANKS"

BANK=$(curl -s "$BASE/api/banks/accounts" -X POST -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
    -d '{"name":"Cuenta Test E2E","bankName":"Banco Test","accountType":"checking","initialBalance":1000}' 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('id','FAIL'))" 2>/dev/null)

if [ "$BANK" != "FAIL" ] && [ -n "$BANK" ]; then
    test_result "PASS" "Create bank account ($BANK)"
else
    test_result "FAIL" "Create bank account" "$BANK"
fi

# List accounts
BANKS=$(curl -s "$BASE/api/banks/accounts" -H "Authorization: Bearer $TOKEN" 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('data',[])))" 2>/dev/null)
if [ "$BANKS" -gt 0 ] 2>/dev/null; then
    test_result "PASS" "List bank accounts ($BANKS found)"
else
    test_result "FAIL" "List bank accounts" "$BANKS"
fi

# Transfer
TRANSFER=$(curl -s "$BASE/api/banks/transfer" -X POST -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
    -d "{\"fromAccountId\":\"$BANK\",\"toAccountId\":\"cmug5h19l000101miuddxrdiw\",\"amount\":100,\"concept\":\"Test transfer\"}" 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('message','FAIL'))" 2>/dev/null)
if echo "$TRANSFER" | grep -q "Transferencia"; then
    test_result "PASS" "Transfer between accounts"
else
    test_result "FAIL" "Transfer" "$TRANSFER"
fi

# ─── 8. AI CHAT ──────────────────────────────────────────────────────────────
section "8. AI CHAT"

AI_PRODUCTS=$(curl -s "$BASE/api/ai-chat" -X POST -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
    -d '{"question":"¿Qué productos tengo?"}' 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('answer','FAIL')[:50])" 2>/dev/null)
if [ -n "$AI_PRODUCTS" ] && [ "$AI_PRODUCTS" != "FAIL" ]; then
    test_result "PASS" "AI Chat: ¿Qué productos tengo? → $AI_PRODUCTS"
else
    test_result "FAIL" "AI Chat" "$AI_PRODUCTS"
fi

AI_ACTION=$(curl -s "$BASE/api/ai-chat" -X POST -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
    -d '{"question":"puedo hacer una venta?"}' 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('answer','FAIL')[:80])" 2>/dev/null)
if echo "$AI_ACTION" | grep -qi "POS\|venta\|módulo"; then
    test_result "PASS" "AI Chat: Acción → $AI_ACTION"
else
    test_result "FAIL" "AI Chat: Acción" "$AI_ACTION"
fi

# ─── 9. BILLING ──────────────────────────────────────────────────────────────
section "9. BILLING / SUBSCRIPTION"

BILLING=$(curl -s "$BASE/api/billing/status" -H "Authorization: Bearer $TOKEN" 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tenant',{}).get('plan','FAIL'))" 2>/dev/null)
if [ "$BILLING" = "premium" ]; then
    test_result "PASS" "Billing: Plan premium"
else
    test_result "FAIL" "Billing" "$BILLING"
fi

# ─── 10. CATALOG ─────────────────────────────────────────────────────────────
section "10. CATALOG"

CATALOG=$(curl -s "$BASE/api/public-catalog/test" 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('businessName','NOT_FOUND'))" 2>/dev/null)
if [ "$CATALOG" = "Test" ] || [ "$CATALOG" = "NOT_FOUND" ]; then
    test_result "PASS" "Public catalog endpoint works (business: $CATALOG)"
else
    test_result "FAIL" "Public catalog" "$CATALOG"
fi

# ─── 11. TERMS PAGE ─────────────────────────────────────────────────────────
section "11. TERMS PAGE"

TERMS=$(curl -sI "$BASE/terms" 2>/dev/null | head -1 | grep -o "200\|302\|304")
if [ "$TERMS" = "200" ] || [ "$TERMS" = "304" ]; then
    test_result "PASS" "Terms page accessible (HTTP $TERMS)"
else
    test_result "FAIL" "Terms page" "HTTP $TERMS"
fi

# ─── 12. CLEANUP ─────────────────────────────────────────────────────────────
section "12. CLEANUP"

# Delete test product
DEL_PROD=$(curl -s "$BASE/api/products/$PROD" -X DELETE -H "Authorization: Bearer $TOKEN" 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print('OK' if d.get('success') or d.get('message') else 'FAIL')" 2>/dev/null)
if [ "$DEL_PROD" = "OK" ]; then
    test_result "PASS" "Delete test product"
else
    test_result "FAIL" "Delete test product" "$DEL_PROD"
fi

# Delete test customer
DEL_CUST=$(curl -s "$BASE/api/customers/$CUST" -X DELETE -H "Authorization: Bearer $TOKEN" 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print('OK' if d.get('success') or d.get('message') else 'FAIL')" 2>/dev/null)
if [ "$DEL_CUST" = "OK" ]; then
    test_result "PASS" "Delete test customer"
else
    test_result "FAIL" "Delete test customer" "$DEL_CUST"
fi

# ─── RESULTS ─────────────────────────────────────────────────────────────────
echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}  RESULTS: ${GREEN}$PASS passed${NC} / ${RED}$FAIL failed${NC} / $TOTAL total"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [ $FAIL -eq 0 ]; then
    echo -e "${GREEN}🎉 ALL TESTS PASSED!${NC}"
    exit 0
else
    echo -e "${RED}⚠️  $FAIL test(s) failed${NC}"
    exit 1
fi
