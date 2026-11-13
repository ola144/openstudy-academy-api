import dotenv from "dotenv";
dotenv.config();

type PaystackBank = {
  id: number;
  name: string;
  slug: string;
  code: string;
  longcode: string;
  gateway: string | null;
  pay_with_bank: boolean;
  active: boolean;
  country: string;
  currency: string;
};

export const getAllPaystackBanks = async () => {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;

  if (!secretKey) {
    throw Object.assign(new Error("PAYSTACK_SECRET_KEY is not configured."), {
      statusCode: 500,
    });
  }

  const response = await fetch(
    "https://api.paystack.co/bank?country=nigeria&perPage=100",
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
    },
  );

  const result = (await response.json()) as {
    status: boolean;
    message: string;
    data: PaystackBank[];
  };

  if (!response.ok || !result.status) {
    throw Object.assign(new Error(result.message || "Unable to fetch banks."), {
      statusCode: response.status || 502,
    });
  }

  return result.data
    .filter((bank) => bank.active && bank.currency === "NGN")
    .map((bank) => ({
      id: bank.id,
      name: bank.name,
      code: bank.code,
      slug: bank.slug,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
};
