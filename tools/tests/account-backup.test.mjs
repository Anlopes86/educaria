import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const source = fs.readFileSync(new URL("../../assets/js/settings-page.js", import.meta.url), "utf8");
const functions = source.slice(source.indexOf("function settingsParseStoredValue"), source.indexOf("function downloadSettingsJson"));
function setup() {
    let uid = "teacher-a";
    const data = { "educaria:lessons:teacher-a": '[{"title":"A"}]', "educaria:lessons:teacher-b": '[{"title":"B"}]',
        "educaria:analytics:events": JSON.stringify([{ teacherUid: "teacher-a", type: "own" }, { teacherUid: "teacher-b", type: "private" }, { type: "anonymous" }]),
        "educaria:auth:session": "private", "educaria:i18n:language": "pt" };
    const context = vm.createContext({ console, localStorage: { length: Object.keys(data).length, key: i => Object.keys(data)[i], getItem: k => data[k] },
        educariaCurrentUserScope: () => uid, settingsCurrentTeacher: () => ({ uid }), settingsServices: () => ({ auth: { currentUser: { uid } } }) });
    vm.runInContext(functions, context);
    return { context, switchAccount: () => { uid = "teacher-b"; } };
}
test("account backup excludes another account's local materials, events and login data", () => {
    const { context } = setup();
    const result = context.settingsLocalAccountData();
    assert.equal(result.values["educaria:lessons:teacher-b"], undefined);
    assert.equal(result.values["educaria:auth:session"], undefined);
    assert.equal(result.values["educaria:analytics:events"].length, 1);
    assert.equal(result.values["educaria:analytics:events"][0].type, "own");
});
test("backup aborts if the signed-in account changes during remote export", async () => {
    const { context, switchAccount } = setup();
    context.settingsRemoteAccountData = async () => { switchAccount(); return { lessons: [] }; };
    await assert.rejects(context.buildSettingsAccountExport(), /conta mudou/);
});
test("partial backup clearly reports unavailable remote data", async () => {
    const { context } = setup();
    context.settingsRemoteAccountData = async () => { throw new Error("offline"); };
    context.console = { warn() {} };
    const result = await context.buildSettingsAccountExport();
    assert.equal(result.remote, null); assert.equal(result.warnings.length, 1);
    assert.equal(result.teacher.uid, "teacher-a");
});
