"use client";

import { createDataProvider } from "@toolpad/dashboard";
import { faker } from "@faker-js/faker";
import invariant from "invariant";

export type Employee = {
  id: number;
  name: string;
  age: number;
  active: boolean;
  lastContacted: Date;
};

let nextId = 1;
const getNextId = () => nextId++;
const DATA: Employee[] = Array.from(Array(10000), () => ({
  id: getNextId(),
  name: faker.person.fullName(),
  age: faker.number.int({ min: 18, max: 65 }),
  active: faker.datatype.boolean(),
  lastContacted: faker.date.recent(),
}));

const delay = async (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const employees = createDataProvider<Employee>({
  async getMany({ filter, pagination }) {
    await delay(500);
    invariant(pagination, "Pagination is required");
    return {
      rows: DATA.slice(
        pagination.start,
        pagination.start + pagination.pageSize,
      ),
      totalCount: DATA.length,
    };
  },
  async getOne(id) {
    await delay(500);
    return DATA.find((row) => row.id === Number(id)) ?? null;
  },
  async createOne(values) {
    await delay(500);
    const newRow = { ...values, id: getNextId() };
    DATA.push(newRow);
    return newRow;
  },
  async updateOne(id, values) {
    await delay(500);
    const index = DATA.findIndex((row) => row.id === Number(id));
    if (index < 0) {
      throw new Error(`Employee with id ${id} not found`);
    }

    DATA[index] = { ...DATA[index], ...values };

    return DATA[index];
  },
  async deleteOne(id) {
    await delay(500);
    const index = DATA.findIndex((row) => row.id === Number(id));
    if (index >= 0) {
      DATA.splice(index, 1);
    }
  },
  fields: {
    name: {
      label: "Name",
    },
    age: {
      label: "Age",
      type: "number",
    },
    active: {
      label: "Active",
      type: "boolean",
    },
    lastContacted: {
      label: "Last Contacted",
      type: "date",
    },
  },
});
