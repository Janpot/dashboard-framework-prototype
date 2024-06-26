"use client";

import * as React from "react";
import {
  Dashboard,
  DataGrid,
  LineChart,
  BarChart,
  Metric,
  useUrlQueryParameterState,
} from "@toolpad/dashboard";
import {
  Box,
  Card,
  CardContent,
  Container,
  Stack,
  TextField,
  Toolbar,
  Typography,
} from "@mui/material";
import Grid from "@mui/material/Unstable_Grid2";
import { CITIES, forecast } from "./data";
import { MenuItem } from "@mui/material";

const FORECAST_X_AXIS = [{ dataKey: "time" }];

const DEFAULT_CITY = [...CITIES.keys()][0];

export default function DashboardContent() {
  const [city, setCity] = useUrlQueryParameterState("city", {
    defaultValue: DEFAULT_CITY,
  });

  return (
    <Dashboard bindings={[[forecast, { city: { eq: city } }]]}>
      <Container sx={{ mt: 5 }}>
        <Stack direction="column" spacing={4}>
          <Toolbar disableGutters>
            <Typography variant="h4">Weather Forecast</Typography>
            <Box sx={{ flexGrow: 1 }} />
            <TextField
              select
              label="City"
              value={city}
              onChange={(event) => setCity(event.target.value)}
            >
              {Array.from(CITIES.keys(), (city) => (
                <MenuItem key={city} value={city}>
                  {city}
                </MenuItem>
              ))}
            </TextField>
          </Toolbar>
          <Box sx={{ height: 400 }}>
            <DataGrid dataProvider={forecast} pagination autoPageSize />
          </Box>
          <Box>
            <Grid container spacing={4}>
              <Grid xs={12} md={4}>
                <Metric dataProvider={forecast} field="temperature" />
              </Grid>
              <Grid xs={12} md={4}>
                <Metric dataProvider={forecast} field="wind" />
              </Grid>
              <Grid xs={12} md={4}>
                <Metric dataProvider={forecast} field="precipitation" />
              </Grid>
            </Grid>
          </Box>
          <Card>
            <CardContent>
              <LineChart
                dataProvider={forecast}
                xAxis={FORECAST_X_AXIS}
                series={[{ dataKey: "temperature" }]}
              />
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <LineChart
                dataProvider={forecast}
                xAxis={FORECAST_X_AXIS}
                series={[{ dataKey: "wind", area: true }]}
              />
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <BarChart
                dataProvider={forecast}
                xAxis={FORECAST_X_AXIS}
                series={[{ dataKey: "precipitation" }]}
              />
            </CardContent>
          </Card>
        </Stack>
      </Container>
    </Dashboard>
  );
}
