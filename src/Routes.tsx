import React from "react";
import { history } from "util/history";
import { IntlProvider } from "react-intl";
import { observer } from "mobx-react";
import { useStore } from "store/RootStore";
import { Router, Switch, Redirect, Route } from "react-router-dom";
import { Loading } from "screen/Loading";
import { languages } from "i18n";
import { ApiList } from "screen/ApiList";
import { Layout } from "component/Layout";
import { History } from "screen/History";
import { Environment } from "screen/Environment";

interface Props {}

export const Routes = observer((props: Props) => {
  const { configStore } = useStore();

  return (
    <IntlProvider
      messages={languages[configStore.language]}
      locale={configStore.language}
      defaultLocale="en-US"
    >
      <Router history={history}>
        <Layout>
          <Switch>
            <Route path="/loading" component={Loading} />
            <Route path="/history" component={History} />
            <Route path="/api-list" component={ApiList} />
            <Route path="/environment" component={Environment} />
            <Redirect from="/" to="/api-list" />
          </Switch>
        </Layout>
      </Router>
    </IntlProvider>
  );
});
