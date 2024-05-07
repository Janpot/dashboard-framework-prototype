"use client";

import { createDataProvider } from "@toolpad/dashboard";

export type Employee = {
  id: number;
  name: string;
  age: number;
  active: boolean;
  lastContacted: Date;
};

let nextId = 1;
const getNextId = () => nextId++;
const DATA: Employee[] = [
  {
    id: getNextId(),
    name: "John Doe",
    age: 25,
    active: true,
    lastContacted: new Date(),
  },
  {
    id: getNextId(),
    name: "Jane Doe",
    age: 21,
    active: false,
    lastContacted: new Date(),
  },
];

const delay = async (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const employees = createDataProvider<Employee>({
  async getMany({ filter }) {
    await delay(500);
    return {
      rows: [...DATA],
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
