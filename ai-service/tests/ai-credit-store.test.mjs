import assert from "node:assert/strict";
import { test } from "node:test";
import { createAiCreditStore } from "../ai-credit-store.js";

function bucket(userId, day = "2026-09-28") {
    return {
        key: `${userId}:free:${day}`,
        userId,
        day,
        plan: "free"
    };
}

test("keeps AI balances separate for each authenticated user", async () => {
    const store = createAiCreditStore({ type: "memory" });
    const teacherA = bucket("teacher-a");
    const teacherB = bucket("teacher-b");

    const reservation = await store.reserve({ ...teacherA, limit: 1000, amount: 120 });
    const settlement = await store.settle({
        key: teacherA.key,
        reservationId: reservation.reservationId,
        limit: 1000,
        amount: 43
    });

    assert.equal(settlement.charged, 43);
    assert.equal((await store.get(teacherA)).used, 43);
    assert.equal((await store.get(teacherB)).used, 0);
});

test("reserves credits atomically when the same user generates twice", async () => {
    const store = createAiCreditStore({ type: "memory" });
    const teacher = bucket("teacher-concurrent");

    const reservations = await Promise.all([
        store.reserve({ ...teacher, limit: 100, amount: 80 }),
        store.reserve({ ...teacher, limit: 100, amount: 80 })
    ]);

    assert.equal(reservations.filter((item) => item.reserved).length, 2);
    assert.equal(reservations.reduce((total, item) => total + item.cost, 0), 100);
    assert.equal((await store.get(teacher)).used, 100);
});

test("refunds only the reservation that belongs to the failed generation", async () => {
    const store = createAiCreditStore({ type: "memory" });
    const teacher = bucket("teacher-refund");
    const first = await store.reserve({ ...teacher, limit: 1000, amount: 90 });
    const second = await store.reserve({ ...teacher, limit: 1000, amount: 60 });

    await store.refund({ key: teacher.key, reservationId: first.reservationId });
    assert.equal((await store.get(teacher)).used, 60);

    const settlement = await store.settle({
        key: teacher.key,
        reservationId: second.reservationId,
        limit: 1000,
        amount: 25
    });
    assert.equal(settlement.charged, 25);
    assert.equal((await store.get(teacher)).used, 25);
});

test("deleting an account removes only that user's credit history", async () => {
    const store = createAiCreditStore({ type: "memory" });
    const teacherA = bucket("teacher-delete");
    const teacherB = bucket("teacher-keep");

    await store.reserve({ ...teacherA, limit: 1000, amount: 40 });
    await store.reserve({ ...teacherB, limit: 1000, amount: 55 });
    await store.deleteUser(teacherA.userId);

    assert.equal((await store.get(teacherA)).used, 0);
    assert.equal((await store.get(teacherB)).used, 55);
});

