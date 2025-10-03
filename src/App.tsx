import React, { useState } from "react";
import { ArrowRight, CheckCircle, Phone, Mail, MapPin } from "lucide-react";

type FormDataT = {
  name: string;
  company: string;
  email: string;
  phone: string;
  role: string;
  message: string;
};

type PrecheckResult = {
  shouldInsert: boolean;
  reasons: string[];
  emailRaw: string;
  emailLocal: string | null;
  emailDomain: string | null;
  emailSyntaxOk: boolean;
  emailDisposable: boolean;
  emailNormalized: string | null;
  phoneClean: string | null;
  mxCheckUrl: string | null;
};

const disposableSet = new Set<string>([
  "mailinator.com",
  "tempmail.com",
  "10minutemail.com",
  "guerrillamail.com",
  "discard.email",
  "trashmail.com",
  "fakeinbox.com",
  "yopmail.com",
  "getnada.com",
  "tempm.com",
  "emailondeck.com",
  "burnermail.io",
  "trashmail.io",
  "maildrop.cc",
  "moakt.com",
  "dispostable.com",
  "tempr.email",
  "sharklasers.com",
]);

const emailSyntaxRe = /^[^\s@]+@[^\s@]+\.[A-Za-z0-9-]{2,}$/i;

function splitEmail(raw: string): { local: string; domain: string } {
  const [local = "", domain = ""] = raw.split("@");
  return { local, domain: domain.toLowerCase().trim() };
}

function normalizeGmail(local: string, domain: string) {
  if (["gmail.com", "googlemail.com"].includes(domain)) {
    const normLocal = local.replace(/\./g, "").replace(/\+.*$/, "");
    return { local: normLocal, domain: "gmail.com" };
  }
  return { local, domain };
}

function cleanPhone(p: string): string {
  return String(p || "")
    .trim()
    .replace(/[^0-9+]/g, "");
}

// ตรวจ MX ผ่าน Cloudflare DoH
async function checkMx(domain: string): Promise<boolean> {
  if (!domain) return false;

  const endpoints = [
    `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(
      domain
    )}&type=MX`,
    `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=MX`,
  ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/dns-json" },
      });
      if (!res.ok) continue;

      const data = await res.json();
      const answers = Array.isArray(data?.Answer) ? data.Answer : [];

      // MX = type 15 ตามรหัส DNS (RFC 1035)
      const ok = answers.some(
        (a: any) =>
          Number(a?.type) === 15 &&
          typeof a?.data === "string" &&
          a.data.trim() !== ""
      );

      if (ok) return true;
    } catch {
      // ignore แล้วลอง endpoint ถัดไป
    }
  }

  return false;
}

function precheck(form: FormDataT): PrecheckResult {
  const emailRaw = String(form.email || "").trim();
  const emailSyntaxOk = emailSyntaxRe.test(emailRaw);

  let emailLocal = "";
  let emailDomain = "";

  if (emailSyntaxOk) {
    const parts = splitEmail(emailRaw);
    emailLocal = parts.local;
    emailDomain = parts.domain;
  }

  const emailDisposable = emailDomain ? disposableSet.has(emailDomain) : false;

  let { local: normLocal, domain: normDomain } = normalizeGmail(
    emailLocal,
    emailDomain
  );

  const emailNormalized =
    normLocal && normDomain ? `${normLocal}@${normDomain}` : null;

  const phoneCleaned = cleanPhone(form.phone);

  const mxCheckUrl = emailDomain
    ? `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(
        emailDomain
      )}&type=MX`
    : null;

  const reasons: string[] = [];
  if (!emailSyntaxOk) reasons.push("invalid syntax");
  if (!emailDomain) reasons.push("no domain");
  if (emailDisposable) reasons.push("disposable domain");

  const shouldInsert = reasons.length === 0;

  return {
    shouldInsert,
    reasons,
    emailRaw,
    emailLocal: emailLocal || null,
    emailDomain: emailDomain || null,
    emailSyntaxOk,
    emailDisposable,
    emailNormalized,
    phoneClean: phoneCleaned || null,
    mxCheckUrl,
  };
}

function App() {
  const [formData, setFormData] = useState<FormDataT>({
    name: "",
    company: "",
    email: "",
    phone: "",
    role: "",
    message: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors([]); // เคลียร์ error เมื่อแก้ไข
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;

    // 1) ตรวจเบื้องต้น
    const pre = precheck(formData);
    if (!pre.shouldInsert) {
      setErrors(pre.reasons);
      alert("อีเมลไม่ผ่านการตรวจสอบ: " + pre.reasons.join(", "));
      return;
    }

    // 2) (ตัวเลือก) ตรวจ MX จริงก่อนบันทึก ----
    const mxOk = await checkMx(pre.emailDomain || "");
    if (!mxOk) {
      setErrors(["no MX record"]);
      alert(
        "อีเมลนี้ไม่ถูกต้อง หรืออาจไม่สามารถตรวจสอบได้ กรุณากรอก อีเมลให้ถูกต้อง "
      );
      return;
    }

    setSubmitting(true);

    // << เปลี่ยนเป็น URL /exec ของคุณ >>
    const SCRIPT_URL =
      "https://script.google.com/macros/s/AKfycbzEVhRpXLjQie1ahbHaVn0UcrsUK-z4XPKph5yyoGHLIqpBw4nhMO7P5e3HZVcQh7s/exec";

    const fd = new FormData();
    fd.append("name", formData.name);
    fd.append("company", formData.company);

    fd.append("email_raw", pre.emailRaw);
    fd.append("email_normalized", pre.emailNormalized || pre.emailRaw);

    fd.append("email", pre.emailNormalized || pre.emailRaw);
    fd.append("phone", pre.phoneClean || "");
    fd.append("role", formData.role);
    fd.append("message", formData.message);

    fd.append("email_domain", pre.emailDomain || "");
    fd.append("email_syntax_ok", String(pre.emailSyntaxOk));
    fd.append("email_disposable", String(pre.emailDisposable));

    try {
      // ใช้ no-cors เพื่อให้ Apps Script รับได้ทุกโดเมน (opaque response)
      // await fetch(SCRIPT_URL, {
      //   method: "POST",
      //   body: fd,
      //   mode: "no-cors",
      // });
      const res = await fetch(SCRIPT_URL, { method: "POST", body: fd });
      const data = await res.json(); // { ok:true, row:..., lead_id:"L0xx" }
      if (data.ok) {
        // alert(`ส่งเรียบร้อย! เลขลูกค้า: ${data.lead_id}`);
        alert("ขอบคุณสำหรับความสนใจ! เราจะติดต่อกลับภายใน 24 ชั่วโมง");
      }

      setFormData({
        name: "",
        company: "",
        email: "",
        phone: "",
        role: "",
        message: "",
      });
      setErrors([]);
    } catch (error) {
      console.error("Submit error:", error);
      alert("มีบางอย่างผิดพลาด กรุณาลองใหม่อีกครั้ง");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-900 via-blue-800 to-green-700 text-white">
        <div className="container mx-auto px-6 py-20">
          <div className="flex flex-col lg:flex-row items-center">
            <div className="lg:w-1/2 mb-12 lg:mb-0">
              <img
                src="/full_logo_txt_white.png"
                alt="Selfmade Finance"
                className="h-16 mb-8"
              />
              <h1 className="text-5xl lg:text-6xl font-bold mb-6 leading-tight">
                เปลี่ยน<span className="text-green-400">ใบแจ้งหนี้</span>
                <br />
                เป็น<span className="text-green-400">เงินสดทันที</span>
              </h1>
              <p className="text-xl lg:text-2xl mb-8 text-blue-100 leading-relaxed">
                Supply Chain Financing ที่ช่วยให้ธุรกิจของคุณมีสภาพคล่องดีขึ้น
                ไม่ต้องรอเงิน ไม่ต้องกู้ดอกเบี้ยสูง
              </p>
              <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
                <div>
                  <h3 className="text-2xl font-bold mb-2">เพิ่มสภาพคล่อง</h3>
                  <p className="text-blue-100">ได้เงินสดภายใน 24 ชั่วโมง</p>
                  <div className="space-y-4 mt-4">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-green-400" />
                      <span>อนุมัติเร็ว ไม่ซับซ้อน</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-green-400" />
                      <span>ไม่ต้องมีหลักทรัพย์ค้ำประกัน</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() =>
                    document
                      .getElementById("contact")
                      ?.scrollIntoView({ behavior: "smooth" })
                  }
                  className="bg-green-500 hover:bg-green-600 text-white px-8 py-4 rounded-lg text-lg font-semibold flex items-center gap-2 transition-all duration-300 transform hover:scale-105"
                >
                  เพิ่มสภาพคล่อง ปรึกษา <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="lg:w-1/2 flex justify-center">
              <div className="bg-white backdrop-blur-sm rounded-2xl p-8 max-w-md">
                <div className="text-center mb-6">
                  <div className="h-16 flex items-center justify-center mx-auto mb-4 rounded-xl backdrop-blur-md">
                    <h3 className="text-2xl font-bold mb-2 text-black">
                      พิเศษ! สำหรับลูกค้า
                    </h3>
                  </div>
                  <img
                    src="/zupport_logo.png"
                    className="w-full max-h-full object-contain"
                    alt="Zupport Logo"
                  />
                  <h3 className="text-2xl font-bold mb-2 text-black">
                    ในงานนี้เท่านั้น
                  </h3>
                </div>
                <div className="flex justify-center">
                  <button
                    onClick={() =>
                      document
                        .getElementById("contact")
                        ?.scrollIntoView({ behavior: "smooth" })
                    }
                    className="text-white px-8 py-4 rounded-lg text-lg font-semibold flex items-center gap-2 transition-all duration-300 transform hover:scale-105"
                    style={{
                      backgroundColor: "#f4b63f",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.backgroundColor = "#d99e2a")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.backgroundColor = "#f4b63f")
                    }
                  >
                    คลิกที่นี่
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-800 mb-6">
              ขั้นตอนการใช้งาน
            </h2>
            <p className="text-xl text-gray-600">
              เพียง 4 ขั้นตอนง่าย ๆ ก็ได้เงินสดทันที
            </p>
          </div>

          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              {/* Left side - Steps */}
              <div className="space-y-8">
                <div className="flex items-start gap-4">
                  <div className="bg-blue-500 text-white w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold flex-shrink-0">
                    1
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-800 mb-2">
                      ส่งใบสมัคร และ ตัวอย่างใบแจ้งหนี้
                    </h3>
                    <p className="text-gray-600">
                      Upload ข้อมูลต่างๆ ประกอบการสมัครผ่านระบบ
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="bg-blue-500 text-white w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold flex-shrink-0">
                    2
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-800 mb-2">
                      ประเมินวงเงินสินเชื่อ
                    </h3>
                    <p className="text-gray-600">
                      เราตรวจสอบเครดิตของลูกค้าและอนุมัติอย่างรวดเร็ว
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="bg-green-500 text-white w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold flex-shrink-0">
                    3
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-800 mb-2">
                      ทราบผลของวงเงิน
                    </h3>
                    <p className="text-gray-600">
                      ลูกค้าสามารถเริ่มต้นส่งใบแจ้งหนี้
                      เพื่อขอสินเชื่อผ่านระบบได้ทันทีหลังอนุมัติ
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="bg-gray-500 text-white w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold flex-shrink-0">
                    4
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-800 mb-2">
                      ลูกค้ารับเงิน
                    </h3>
                    <p className="text-gray-600">
                      ได้รับเงินภายใน 24 ชั่วโมง หลังจากทำรายการ
                    </p>
                  </div>
                </div>
              </div>

              {/* Right side - CTA */}
              <div className="flex justify-center lg:justify-end">
                <div className="text-center">
                  <button
                    onClick={() =>
                      document
                        .getElementById("contact")
                        ?.scrollIntoView({ behavior: "smooth" })
                    }
                    className="bg-green-500 hover:bg-green-600 text-white px-8 py-4 rounded-lg text-lg font-semibold flex items-center gap-2 transition-all duration-300 transform hover:scale-105"
                  >
                    เพิ่มสภาพคล่อง ปรึกษา <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Form */}
      <section id="contact" className="py-20 bg-gray-50">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold text-gray-800 mb-6">
                พร้อมเพิ่มสภาพคล่องให้ธุรกิจแล้วหรือยัง?
              </h2>
              <p className="text-xl text-gray-600">
                ปรึกษาฟรีกับผู้เชี่ยวชาญ หรือกรอกข้อมูลเพื่อรับ Promotion
              </p>
            </div>

            <div className="grid lg:grid-cols-2 gap-12">
              {/* Contact Form Card */}
              <div className="bg-white rounded-xl p-8 shadow-lg">
                <h3 className="text-2xl font-bold text-gray-800 mb-6">
                  ติดต่อเรา
                </h3>

                {/* แสดง Error ถ้ามี */}
                {errors.length > 0 && (
                  <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
                    <div className="font-semibold mb-2">พบข้อผิดพลาด</div>
                    <ul className="list-disc list-inside text-sm">
                      {errors.map((er, idx) => (
                        <li key={idx}>{er}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        ชื่อ-นามสกุล *
                      </label>
                      <input
                        type="text"
                        name="name"
                        required
                        value={formData.name}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="กรอกชื่อ-นามสกุล"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        บริษัท *
                      </label>
                      <input
                        type="text"
                        name="company"
                        required
                        value={formData.company}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="ชื่อบริษัท"
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        อีเมล *
                      </label>
                      <input
                        type="email"
                        name="email"
                        required
                        value={formData.email}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="your@email.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        เบอร์โทร *
                      </label>
                      <input
                        type="tel"
                        name="phone"
                        required
                        value={formData.phone}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="08X-XXX-XXXX"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      ตำแหน่ง/บทบาท
                    </label>
                    <select
                      name="role"
                      value={formData.role}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">เลือกตำแหน่ง</option>
                      <option value="owner">เจ้าของกิจการ</option>
                      <option value="ceo">CEO/MD</option>
                      <option value="cfo">CFO</option>
                      <option value="finance">ฝ่ายการเงิน</option>
                      <option value="procurement">ฝ่ายจัดซื้อ</option>
                      <option value="other">อื่น ๆ</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      ข้อความ/คำถาม
                    </label>
                    <textarea
                      name="message"
                      rows={4}
                      value={formData.message}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="บอกเราเกี่ยวกับความต้องการของคุณ..."
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    aria-busy={submitting}
                    className={`w-full bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 text-white px-8 py-4 rounded-lg text-lg font-semibold transition-all duration-300 transform ${
                      submitting
                        ? "opacity-60 cursor-not-allowed"
                        : "hover:scale-105"
                    }`}
                  >
                    {submitting ? "กำลังส่งข้อมูล..." : "ส่งข้อมูลและนัดหมาย"}
                  </button>
                </form>
              </div>

              {/* Contact Info */}
              <div className="space-y-8">
                <div className="bg-white rounded-xl p-8 shadow-lg">
                  <h3 className="text-2xl font-bold text-gray-800 mb-6">
                    ติดต่อโดยตรง
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="bg-blue-100 p-3 rounded-lg">
                        <Phone className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <div className="font-semibold text-gray-800">
                          โทรศัพท์
                        </div>
                        <div className="text-gray-600">
                          085 872 9728, 02 275 5551{" "}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="bg-green-100 p-3 rounded-lg">
                        <Mail className="w-6 h-6 text-green-600" />
                      </div>
                      <div>
                        <div className="font-semibold text-gray-800">อีเมล</div>
                        <div className="text-gray-600">
                          infoadmin@selfmade.finance
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="bg-purple-100 p-3 rounded-lg">
                        <MapPin className="w-6 h-6 text-purple-600" />
                      </div>
                      <div>
                        <div className="font-semibold text-gray-800">
                          ที่อยู่
                        </div>
                        <div className="text-gray-600">
                          New Paradigm Co., Ltd. (Head Office)
                          <br />
                          252/91, Muang Thai-Phatra Complex Building (Tower B),
                          16th Floor
                          <br />
                          Room 252/91(H), Ratchadaphisek Road, Huaykwang,
                          Bangkok 10310
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              {/* End Right */}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-6 md:mb-0">
              <img
                src="/icon_2.png"
                alt="Selfmade Finance"
                className="h-12 mb-4"
              />
              <p className="text-gray-400">
                Supply Chain Finance ที่ช่วยให้ธุรกิจไทยเติบโต
              </p>
            </div>
            <div className="text-center md:text-right">
              <p className="text-gray-400 mb-2">
                © 2025 Selfmade Finance. All rights reserved.
              </p>
              <p className="text-sm text-gray-500">
                ได้รับใบอนุญาตจากธนาคารแห่งประเทศไทย
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
