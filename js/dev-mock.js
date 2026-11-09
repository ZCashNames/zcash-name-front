// Test data in place of the registrar, for working on the interface without a backend.
//
// js/app.js imports this file only on a local copy of the app opened with ?mock=1 (see
// mockModeRequested() there). The site never loads it. While it is installed, every request
// to the registrar is answered here, a request it has no answer for gets a 404 instead of
// going out, and a label in the corner of the page says test data is on.

export function installMock({ apiBase, getCachedPublicKey }) {
    const label = document.createElement('div');
    label.textContent = 'Test data (?mock=1): nothing is sent to the registrar';
    Object.assign(label.style, {
        position: 'fixed', left: '8px', bottom: '8px', zIndex: '10000', padding: '4px 10px',
        borderRadius: '6px', background: '#b45309', color: '#fff', pointerEvents: 'none',
        font: '600 12px/1.5 Inter, system-ui, sans-serif',
    });
    document.body.appendChild(label);

    const originalFetch = window.fetch;
    window.fetch = async function(input, init) {
        const url = typeof input === 'string' ? input : input.url;

        // 0. Payment address, network and the confirmation counts the registrar waits for
        //    (the local registrar config's thresholds, so they differ from the 20/120 fallback)
        if (url.includes('/v1.0/getPaymentAddress')) {
            return new Response(JSON.stringify({
                response: {
                    address: "u1mockpaymentaddress",
                    network: "mainnet",
                    payment_confirmations: 5,
                    refund_confirmations: 10
                }
            }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        // 1. Check Domain (GET /v1.0/check/{domain})
        if (url.includes('/v1.0/check/') && (!init || init.method === 'GET')) {
            let domain = url.substring(url.indexOf('/check/') + 7);
            const queryIdx = domain.indexOf('?');
            if (queryIdx !== -1) {
                domain = domain.substring(0, queryIdx);
            }
            const isListed = domain.startsWith('listed') || domain.startsWith('selling');
            const isTaken = isListed || domain.startsWith('taken') || domain.startsWith('alice');
            
            return new Response(JSON.stringify({
                response: {
                    exists: isTaken,
                    price: isListed ? "25000000000" : (isTaken ? "0" : (domain.length < 9 ? "15000000000" : "1500000000"))
                }
            }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        // 2. Poll Transaction Status or Availability Check (POST /v1.0/check/{domain})
        if (url.includes('/v1.0/check/') && init && init.method === 'POST') {
            let bodyData = {};
            if (init.body) {
                try {
                    bodyData = JSON.parse(init.body);
                } catch (e) {}
            }
            
            if (bodyData && bodyData.with_pubkey) {
                let domain = url.substring(url.indexOf('/check/') + 7);
                const queryIdx = domain.indexOf('?');
                if (queryIdx !== -1) {
                    domain = domain.substring(0, queryIdx);
                }
                const isListed = domain.startsWith('listed') || domain.startsWith('selling');
                const isTaken = isListed || domain.startsWith('taken') || domain.startsWith('alice');
                
                let pubkey = null;
                const accountStr = localStorage.getItem('zcash_encrypted_account');
                if (accountStr) {
                    try {
                        const data = JSON.parse(accountStr);
                        pubkey = data.pubKeyHex;
                    } catch (e) {}
                }
                if (!pubkey) {
                    pubkey = "mockPubKeyHex";
                }
                
                return new Response(JSON.stringify({
                    response: {
                        exists: isTaken,
                        price: isListed ? "25000000000" : (isTaken ? "0" : (domain.length < 9 ? "15000000000" : "1500000000")),
                        pubkey: pubkey
                    }
                }), { status: 200, headers: { 'Content-Type': 'application/json' } });
            } else {
                const mockConfs = parseInt(sessionStorage.getItem('mock_confs') || '0') + 1;
                sessionStorage.setItem('mock_confs', mockConfs.toString());
                
                let status = 0; // Confirming
                if (mockConfs >= 5) {
                    status = 5; // Success
                    sessionStorage.removeItem('mock_confs');
                }
                
                return new Response(JSON.stringify({
                    response: {
                        status: status,
                        confirmations: mockConfs,
                        seconds: 15,
                        tx_id: "mock_tx_id_123456789"
                    }
                }), { status: 200, headers: { 'Content-Type': 'application/json' } });
            }
        }

        // 3. Get Marketplace or My Domains (POST /v1.0/domains)
        if (url.includes('/v1.0/domains') && init && init.method === 'POST') {
            const body = JSON.parse(init.body);
            const page = body.page || 1;
            const search = (body.search || "").toLowerCase();
            
            if (body.type === 'my') {
                const userPubKey = body.pubkey || "mockPubKeyHex";
                let myMockList = [
                    { domain: "test-identity.zcash", address: "u1mockaddress1234567890abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqrstuvwxyz1234567890abcdef", price: 0, pubkey: userPubKey },
                    { domain: "cool-zcash-alias.secure", address: "u1anothermockaddress1234567890abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqrstuvwxyz12345678", price: 0, pubkey: userPubKey },
                    { domain: "on-sale-domain.safe", address: "ps1qxyanothermockaddress987654", price: 25000000000, tx_price: 1000000000, pubkey: userPubKey }
                ];
                if (search) {
                    myMockList = myMockList.filter(item => item.domain.toLowerCase().includes(search));
                }
                return new Response(JSON.stringify({
                    response: {
                        count: myMockList.length,
                        domains: myMockList
                    }
                }), { status: 200, headers: { 'Content-Type': 'application/json' } });
            }

            let mockList = [
                { domain: "crypto.zcash", price: 15000000000, pubkey: "eb4acf26de7fd06e68b94f4c8fa65f244f2e0dce8e438212ca70b27d216dd098" },
                { domain: "wallet.private", price: 35000000000, pubkey: "3757ee1a8b3f10353ca6edd47b66920392b02e323dca3f3edddb5de142079a53" },
                { domain: "anonymous.secure", price: 80000000000, pubkey: "eb4acf26de7fd06e68b94f4c8fa65f244f2e0dce8e438212ca70b27d216dd098" },
                { domain: "nodes.safe", price: 5000000000, pubkey: "99aa887766554433221100" },
                { domain: "payment.zcash", price: 12000000000, pubkey: "eb4acf26de7fd06e68b94f4c8fa65f244f2e0dce8e438212ca70b27d216dd098" },
                { domain: "privacy.private", price: 45000000000, pubkey: "2233445566778899" },
                { domain: "shielded.secure", price: 99000000000, pubkey: "3757ee1a8b3f10353ca6edd47b66920392b02e323dca3f3edddb5de142079a53" },
                { domain: "backup.safe", price: 3000000000, pubkey: "8877665544332211" }
            ];

            const userPubKey = getCachedPublicKey();
            if (userPubKey) {
                mockList.push({
                    domain: "my-selling-domain.zcash",
                    price: 25000000000,
                    tx_price: 12000000000,
                    pubkey: userPubKey
                });
                mockList.push({
                    domain: "premium.safe",
                    price: 150000000000,
                    tx_price: 60000000000,
                    pubkey: userPubKey
                });
            }

            if (search) {
                mockList = mockList.filter(item => item.domain.toLowerCase().includes(search));
            }

            const count = search ? mockList.length : 125;
            let results = [...mockList];
            
            if (!search) {
                for (let i = mockList.length + 1; i <= 20; i++) {
                    results.push({
                        domain: `dummy${i + (page - 1) * 20}.zcash`,
                        price: (10 + i) * 100000000,
                        pubkey: "dummy_pubkey_hex"
                    });
                }
            }

            return new Response(JSON.stringify({
                response: {
                    count: count,
                    domains: results.slice(0, 20)
                }
            }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        // 4. Remove domain from sale (POST /v1.0/domains/remove)
        if (url.includes('/v1.0/domains/remove') && init && init.method === 'POST') {
            return new Response(JSON.stringify({ response: { success: true } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        // 5. Get My Names (GET /v1.0/names/)
        if (url.includes('/v1.0/names/') && (!init || init.method === 'GET')) {
            return new Response(JSON.stringify({
                response: {
                    names: [
                        { name: "test-identity.zcash", address: "u1mockaddress1234567890abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqrstuvwxyz1234567890abcdef" },
                        { name: "cool-zcash-alias.secure", address: "u1anothermockaddress1234567890abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqrstuvwxyz12345678" }
                    ]
                }
            }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        // 6. Get Prices (POST /v1.0/prices)
        if (url.includes('/v1.0/prices') && init && init.method === 'POST') {
            const body = JSON.parse(init.body);
            if (body.type === 'upd') {
                return new Response(JSON.stringify({
                    response: {
                        "1": 700000000,
                        "2": 600000000,
                        "3": 500000000,
                        "4": 400000000,
                        "5": 300000000,
                        "6": 200000000,
                        "7": 100000000
                    }
                }), { status: 200, headers: { 'Content-Type': 'application/json' } });
            }
        }
        
        // 7. Get or Withdraw Balance (POST /v1.0/balance)
        if (url.includes('/v1.0/balance') && init && init.method === 'POST') {
            const body = JSON.parse(init.body);
            if (body.action === 'get') {
                const mockBalance = window.lastMockBalance !== undefined ? window.lastMockBalance : "410000000";
                return new Response(JSON.stringify({
                    response: {
                        balance: mockBalance,
                        fee: 5,
                        min_withdrawal: 263158
                    }
                }), { status: 200, headers: { 'Content-Type': 'application/json' } });
            } else if (body.action === 'withdraw') {
                window.lastMockBalance = "0.00000000";
                return new Response(JSON.stringify({
                    response: 1
                }), { status: 200, headers: { 'Content-Type': 'application/json' } });
            }
        }

        // 8. Transactions list (POST /v1.0/transactions)
        if (url.includes('/v1.0/transactions') && init && init.method === 'POST') {
            const body = JSON.parse(init.body);
            const page = body.page || 1;
            const count = body.count || 10;
            const type = body.type;

            if (type === 'in') {
                const allIncomingTx = [
                    {
                        domain_name: "hotel.secure",
                        op: "REG",
                        confirmations: 5,
                        status: 5,
                        tx_id: "e95b49dd7ce4830b2fbc696b3e2b0538d55ba22efd622674b0e4af74586e32b1",
                        memo: "zNS:1:REG:hotel.secure:u1mocksourceaddress1234567890abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqrstuvwxyz1234567890:3757ee1a8b3f10353ca6edd47b66920392b02e323dca3f3edddb5de142079a53:1780469310354:cfec7a589378ae4b767b962271170730d77f2fc5007e30e15d7fd90bec1f10a3dd57547d26a75c13e29b508d359bc16dde463ce8a1ec08a3ada9f4c1ad178b04"
                    },
                    {
                        domain_name: "moto321.private",
                        op: "REG",
                        confirmations: 5,
                        status: 5,
                        tx_id: "10ba5332d8fb82d0ffb79355bd8859b724757252fc3b1831ee92f57e9be189d1",
                        memo: "zNS:1:REG:moto321.private:u1mocksourceaddress1234567890abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqrstuvwxyz1234567890:3757ee1a8b3f10353ca6edd47b66920392b02e323dca3f3edddb5de142079a53:1780469215786:cfec7a589378ae4b767b962271170730d77f2fc5007e30e15d7fd90bec1f10a323ddc403d84a6d1168894ea8d4f39420bba2ec70c0c2a082cf2da5f9ab892004"
                    },
                    {
                        domain_name: "crypto-wallet.zcash",
                        op: "REG",
                        confirmations: 5,
                        status: 0,
                        tx_id: "20ba5332d8fb82d0ffb79355bd8859b724757252fc3b1831ee92f57e9be189d2",
                        memo: "zNS:1:REG:crypto-wallet.zcash:u1mocksourceaddress1234567890abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqrstuvwxyz1234567890:3757ee1a8b3f10353ca6edd47b66920392b02e323dca3f3edddb5de142079a53:1780469215786:cfec7a589378ae4b767b962271170730d77f2fc5007e30e15d7fd90bec1f10a323ddc403d84a6d1168894ea8d4f39420bba2ec70c0c2a082cf2da5f9ab892004"
                    },
                    {
                        domain_name: "anonymous.secure",
                        op: "REG",
                        confirmations: 10,
                        status: 1,
                        tx_id: "30ba5332d8fb82d0ffb79355bd8859b724757252fc3b1831ee92f57e9be189d3",
                        memo: "zNS:1:REG:anonymous.secure:u1mocksourceaddress1234567890abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqrstuvwxyz1234567890:3757ee1a8b3f10353ca6edd47b66920392b02e323dca3f3edddb5de142079a53:1780469215786:cfec7a589378ae4b767b962271170730d77f2fc5007e30e15d7fd90bec1f10a323ddc403d84a6d1168894ea8d4f39420bba2ec70c0c2a082cf2da5f9ab892004"
                    },
                    {
                        domain_name: "my-domain.safe",
                        op: "REG",
                        confirmations: 20,
                        status: 2,
                        tx_id: "40ba5332d8fb82d0ffb79355bd8859b724757252fc3b1831ee92f57e9be189d4",
                        memo: "zNS:1:REG:my-domain.safe:u1mocksourceaddress1234567890abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqrstuvwxyz1234567890:3757ee1a8b3f10353ca6edd47b66920392b02e323dca3f3edddb5de142079a53:1780469215786:cfec7a589378ae4b767b962271170730d77f2fc5007e30e15d7fd90bec1f10a323ddc403d84a6d1168894ea8d4f39420bba2ec70c0c2a082cf2da5f9ab892004"
                    },
                    {
                        domain_name: "payment-gate.zcash",
                        op: "REG",
                        confirmations: 20,
                        status: 3,
                        tx_id: "50ba5332d8fb82d0ffb79355bd8859b724757252fc3b1831ee92f57e9be189d5",
                        memo: "zNS:1:REG:payment-gate.zcash:u1mocksourceaddress1234567890abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqrstuvwxyz1234567890:3757ee1a8b3f10353ca6edd47b66920392b02e323dca3f3edddb5de142079a53:1780469215786:cfec7a589378ae4b767b962271170730d77f2fc5007e30e15d7fd90bec1f10a323ddc403d84a6d1168894ea8d4f39420bba2ec70c0c2a082cf2da5f9ab892004"
                    },
                    {
                        domain_name: "privacy-first.private",
                        op: "REG",
                        confirmations: 20,
                        status: 4,
                        tx_id: "60ba5332d8fb82d0ffb79355bd8859b724757252fc3b1831ee92f57e9be189d6",
                        memo: "zNS:1:REG:privacy-first.private:u1mocksourceaddress1234567890abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqrstuvwxyz1234567890:3757ee1a8b3f10353ca6edd47b66920392b02e323dca3f3edddb5de142079a53:1780469215786:cfec7a589378ae4b767b962271170730d77f2fc5007e30e15d7fd90bec1f10a323ddc403d84a6d1168894ea8d4f39420bba2ec70c0c2a082cf2da5f9ab892004"
                    },
                    {
                        domain_name: "orphaned-test.secure",
                        op: "REG",
                        confirmations: 0,
                        status: 6,
                        tx_id: "70ba5332d8fb82d0ffb79355bd8859b724757252fc3b1831ee92f57e9be189d7",
                        memo: "zNS:1:REG:orphaned-test.secure:u1mocksourceaddress1234567890abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqrstuvwxyz1234567890:3757ee1a8b3f10353ca6edd47b66920392b02e323dca3f3edddb5de142079a53:1780469215786:cfec7a589378ae4b767b962271170730d77f2fc5007e30e15d7fd90bec1f10a323ddc403d84a6d1168894ea8d4f39420bba2ec70c0c2a082cf2da5f9ab892004"
                    },
                    {
                        domain_name: "pending-refund-test.safe",
                        op: "REG",
                        confirmations: 80,
                        status: 7,
                        tx_id: "80ba5332d8fb82d0ffb79355bd8859b724757252fc3b1831ee92f57e9be189d8",
                        memo: "zNS:1:REG:pending-refund-test.safe:u1mocksourceaddress1234567890abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqrstuvwxyz1234567890:3757ee1a8b3f10353ca6edd47b66920392b02e323dca3f3edddb5de142079a53:1780469215786:cfec7a589378ae4b767b962271170730d77f2fc5007e30e15d7fd90bec1f10a323ddc403d84a6d1168894ea8d4f39420bba2ec70c0c2a082cf2da5f9ab892004"
                    },
                    {
                        domain_name: "refunded-test.zcash",
                        op: "REG",
                        confirmations: 120,
                        status: 8,
                        tx_id: "90ba5332d8fb82d0ffb79355bd8859b724757252fc3b1831ee92f57e9be189d9",
                        memo: "zNS:1:REG:refunded-test.zcash:u1mocksourceaddress1234567890abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqrstuvwxyz1234567890:3757ee1a8b3f10353ca6edd47b66920392b02e323dca3f3edddb5de142079a53:1780469215786:cfec7a589378ae4b767b962271170730d77f2fc5007e30e15d7fd90bec1f10a323ddc403d84a6d1168894ea8d4f39420bba2ec70c0c2a082cf2da5f9ab892004"
                    },
                    {
                        domain_name: "extra-item-1.secure",
                        op: "REG",
                        confirmations: 5,
                        status: 5,
                        tx_id: "a0ba5332d8fb82d0ffb79355bd8859b724757252fc3b1831ee92f57e9be189da",
                        memo: "zNS:1:REG:extra-item-1.secure:u1mocksourceaddress1234567890abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqrstuvwxyz1234567890:3757ee1a8b3f10353ca6edd47b66920392b02e323dca3f3edddb5de142079a53:1780469215786:cfec7a589378ae4b767b962271170730d77f2fc5007e30e15d7fd90bec1f10a323ddc403d84a6d1168894ea8d4f39420bba2ec70c0c2a082cf2da5f9ab892004"
                    },
                    {
                        domain_name: "extra-item-2.private",
                        op: "REG",
                        confirmations: 5,
                        status: 5,
                        tx_id: "b0ba5332d8fb82d0ffb79355bd8859b724757252fc3b1831ee92f57e9be189db",
                        memo: "zNS:1:REG:extra-item-2.private:u1mocksourceaddress1234567890abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqrstuvwxyz1234567890:3757ee1a8b3f10353ca6edd47b66920392b02e323dca3f3edddb5de142079a53:1780469215786:cfec7a589378ae4b767b962271170730d77f2fc5007e30e15d7fd90bec1f10a323ddc403d84a6d1168894ea8d4f39420bba2ec70c0c2a082cf2da5f9ab892004"
                    }
                ];

                const start = (page - 1) * count;
                const paginatedTx = allIncomingTx.slice(start, start + count);

                return new Response(JSON.stringify({
                    response: {
                        count: allIncomingTx.length,
                        tx: paginatedTx
                    }
                }), { status: 200, headers: { 'Content-Type': 'application/json' } });
            } else if (type === 'ref') {
                const allRefundTx = [];
                for (let i = 1; i <= 22; i++) {
                    const status = i % 5; // every TX_REFUND_* status, 0..4
                    let amount = "";
                    if (i === 1) {
                        amount = "013.3436";
                    } else if (i === 2) {
                        amount = "005.1200";
                    } else {
                        amount = `${i}.0000`;
                    }

                    allRefundTx.push({
                        date: 1717838400 - (i * 86400),
                        amount: amount,
                        tx_id: `e95b49dd7ce4830b2fbc696b3e2b0538d55ba22efd622674b0e4af74586e32b${i.toString(16)}`,
                        status: status,
                        fee: 5
                    });
                }

                const start = (page - 1) * count;
                const paginatedTx = allRefundTx.slice(start, start + count);

                return new Response(JSON.stringify({
                    response: {
                        count: allRefundTx.length,
                        tx: paginatedTx
                    }
                }), { status: 200, headers: { 'Content-Type': 'application/json' } });
            }
        }

        // A registrar request the test data has no answer for stays here as well
        if (url.startsWith(apiBase)) {
            return new Response(JSON.stringify({ error: 'Not in the test data' }),
                { status: 404, headers: { 'Content-Type': 'application/json' } });
        }

        return originalFetch.apply(this, arguments);
    };
}
