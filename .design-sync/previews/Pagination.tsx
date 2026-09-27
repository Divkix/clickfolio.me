import { Pagination } from "@clickfolio/ui";

const noop = () => {};

export const FirstPage = () => <Pagination currentPage={1} totalPages={24} onPageChange={noop} />;

export const MiddlePage = () => (
  <Pagination currentPage={12} totalPages={24} onPageChange={noop} />
);

export const LastPage = () => <Pagination currentPage={24} totalPages={24} onPageChange={noop} />;

export const FewPages = () => <Pagination currentPage={2} totalPages={3} onPageChange={noop} />;
